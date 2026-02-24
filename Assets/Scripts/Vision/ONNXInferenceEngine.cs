using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Unity.Barracuda;

namespace NomadGo.Vision
{
    public class ONNXInferenceEngine : MonoBehaviour
    {
        private string modelPath;
        private string labelsPath;
        private int inputWidth = 640;
        private int inputHeight = 640;
        private float confidenceThreshold = 0.45f;
        private float nmsThreshold = 0.5f;
        private int maxDetections = 100;
        private string[] labels;
        private bool isLoaded = false;
        private float lastInferenceTimeMs = 0f;

        private IWorker worker;
        private Model runtimeModel;

        public bool IsLoaded => isLoaded;
        public float LastInferenceTimeMs => lastInferenceTimeMs;

        public void Initialize(AppShell.ModelConfig config)
        {
            modelPath = config.path;
            labelsPath = config.labels_path;
            inputWidth = config.input_width;
            inputHeight = config.input_height;
            confidenceThreshold = config.confidence_threshold;
            nmsThreshold = config.nms_threshold;
            maxDetections = config.max_detections;

            LoadLabels();
            LoadModel();
        }

        private void LoadLabels()
        {
            TextAsset labelsAsset = Resources.Load<TextAsset>(labelsPath.Replace(".txt", "").Replace("Models/", ""));
            if (labelsAsset == null)
            {
                labelsAsset = Resources.Load<TextAsset>("labels");
            }

            if (labelsAsset != null)
            {
                labels = labelsAsset.text.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
                Debug.Log($"[ONNXEngine] Loaded {labels.Length} labels.");
            }
            else
            {
                labels = new string[] {
                    "bottle", "can", "box", "carton", "bag",
                    "jar", "container", "package", "pouch", "tube"
                };
                Debug.LogWarning("[ONNXEngine] Labels file not found. Using default labels.");
            }
        }

        private void LoadModel()
        {
            try
            {
                // Try loading as an NNModel asset from Resources
                string assetName = System.IO.Path.GetFileNameWithoutExtension(modelPath);
                NNModel modelAsset = Resources.Load<NNModel>(assetName);
                if (modelAsset == null)
                {
                    modelAsset = Resources.Load<NNModel>(modelPath.Replace(".onnx", "").Replace("Models/", ""));
                }

                if (modelAsset != null)
                {
                    runtimeModel = ModelLoader.Load(modelAsset);
                    worker = WorkerFactory.CreateWorker(WorkerFactory.Type.CSharpBurst, runtimeModel);
                    isLoaded = true;
                    Debug.Log($"[ONNXEngine] Model loaded from Resources: {modelAsset.name}");
                    return;
                }

                // Try loading from persistentDataPath (copied there at runtime)
                string persistentPath = System.IO.Path.Combine(Application.persistentDataPath, "model.onnx");
                if (System.IO.File.Exists(persistentPath))
                {
                    using (var stream = System.IO.File.OpenRead(persistentPath))
                    {
                        runtimeModel = ModelLoader.Load(stream);
                    }
                    worker = WorkerFactory.CreateWorker(WorkerFactory.Type.CSharpBurst, runtimeModel);
                    isLoaded = true;
                    Debug.Log($"[ONNXEngine] Model loaded from persistentDataPath: {persistentPath}");
                    return;
                }

                Debug.LogError($"[ONNXEngine] Model not found: {modelPath}. Place the .onnx file in a Resources folder or persistentDataPath.");
                isLoaded = false;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ONNXEngine] Failed to load model: {ex.Message}");
                Debug.LogError($"[ONNXEngine] Stack trace: {ex.StackTrace}");
                isLoaded = false;
            }
        }

        public List<DetectionResult> RunInference(Texture2D frame)
        {
            if (!isLoaded || worker == null)
            {
                Debug.LogWarning("[ONNXEngine] Model not loaded. Skipping inference.");
                return new List<DetectionResult>();
            }

            var stopwatch = System.Diagnostics.Stopwatch.StartNew();

            Tensor inputTensor = PreprocessFrame(frame);
            worker.Execute(inputTensor);
            inputTensor.Dispose();

            Tensor output = worker.PeekOutput();
            List<DetectionResult> rawDetections = ParseOutput(output, frame.width, frame.height);
            output.Dispose();

            List<DetectionResult> finalDetections = ApplyNMS(rawDetections);

            if (finalDetections.Count > maxDetections)
            {
                finalDetections = finalDetections.Take(maxDetections).ToList();
            }

            stopwatch.Stop();
            lastInferenceTimeMs = (float)stopwatch.Elapsed.TotalMilliseconds;

            return finalDetections;
        }

        private Tensor PreprocessFrame(Texture2D frame)
        {
            RenderTexture rt = RenderTexture.GetTemporary(inputWidth, inputHeight);
            Graphics.Blit(frame, rt);

            Texture2D resized = new Texture2D(inputWidth, inputHeight, TextureFormat.RGB24, false);
            RenderTexture.active = rt;
            resized.ReadPixels(new Rect(0, 0, inputWidth, inputHeight), 0, 0);
            resized.Apply();
            RenderTexture.active = null;
            RenderTexture.ReleaseTemporary(rt);

            Color[] pixels = resized.GetPixels();
            Destroy(resized);

            // Barracuda uses NHWC format: [batch=1, height, width, channels=3]
            var tensor = new Tensor(1, inputHeight, inputWidth, 3);
            for (int y = 0; y < inputHeight; y++)
            {
                for (int x = 0; x < inputWidth; x++)
                {
                    int idx = y * inputWidth + x;
                    tensor[0, y, x, 0] = pixels[idx].r;
                    tensor[0, y, x, 1] = pixels[idx].g;
                    tensor[0, y, x, 2] = pixels[idx].b;
                }
            }

            return tensor;
        }

        private List<DetectionResult> ParseOutput(Tensor output, int originalWidth, int originalHeight)
        {
            var detections = new List<DetectionResult>();

            try
            {
                float scaleX = (float)originalWidth / inputWidth;
                float scaleY = (float)originalHeight / inputHeight;
                int numClasses = labels.Length;

                // Barracuda NHWC shape: [batch, height, width, channels]
                // YOLOv8 ONNX output [1, 4+numClasses, numAnchors] maps to NHWC [1, 1, numAnchors, 4+numClasses]
                var shape = output.shape;
                int numDetections = shape.width;
                int rowSize = shape.channels;

                for (int i = 0; i < numDetections; i++)
                {
                    float cx = output[0, 0, i, 0];
                    float cy = output[0, 0, i, 1];
                    float w  = output[0, 0, i, 2];
                    float h  = output[0, 0, i, 3];

                    float bestConf = 0f;
                    int bestClass = -1;

                    for (int c = 0; c < numClasses && (c + 4) < rowSize; c++)
                    {
                        float conf = output[0, 0, i, 4 + c];
                        if (conf > bestConf)
                        {
                            bestConf = conf;
                            bestClass = c;
                        }
                    }

                    if (bestConf >= confidenceThreshold && bestClass >= 0)
                    {
                        float x1 = (cx - w / 2f) * scaleX;
                        float y1 = (cy - h / 2f) * scaleY;
                        float bw = w * scaleX;
                        float bh = h * scaleY;

                        Rect box = new Rect(x1, y1, bw, bh);
                        string label = GetLabel(bestClass);

                        detections.Add(new DetectionResult(bestClass, label, bestConf, box));
                    }
                }

                Debug.Log($"[ONNXEngine] Raw detections: {detections.Count}");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ONNXEngine] Inference error: {ex.Message}");
            }

            return detections;
        }

        private List<DetectionResult> ApplyNMS(List<DetectionResult> detections)
        {
            if (detections.Count == 0) return detections;

            detections.Sort((a, b) => b.confidence.CompareTo(a.confidence));

            List<DetectionResult> kept = new List<DetectionResult>();
            bool[] suppressed = new bool[detections.Count];

            for (int i = 0; i < detections.Count; i++)
            {
                if (suppressed[i]) continue;
                kept.Add(detections[i]);

                for (int j = i + 1; j < detections.Count; j++)
                {
                    if (suppressed[j]) continue;
                    if (detections[i].classId != detections[j].classId) continue;

                    float iou = ComputeIOU(detections[i].boundingBox, detections[j].boundingBox);
                    if (iou > nmsThreshold)
                    {
                        suppressed[j] = true;
                    }
                }
            }

            return kept;
        }

        public static float ComputeIOU(Rect a, Rect b)
        {
            float x1 = Mathf.Max(a.xMin, b.xMin);
            float y1 = Mathf.Max(a.yMin, b.yMin);
            float x2 = Mathf.Min(a.xMax, b.xMax);
            float y2 = Mathf.Min(a.yMax, b.yMax);

            float intersectionArea = Mathf.Max(0, x2 - x1) * Mathf.Max(0, y2 - y1);
            float unionArea = a.width * a.height + b.width * b.height - intersectionArea;

            if (unionArea <= 0) return 0f;
            return intersectionArea / unionArea;
        }

        public string GetLabel(int classId)
        {
            if (labels != null && classId >= 0 && classId < labels.Length)
            {
                return labels[classId];
            }
            return $"class_{classId}";
        }

        private void OnDestroy()
        {
            if (worker != null)
            {
                worker.Dispose();
                worker = null;
                Debug.Log("[ONNXEngine] Inference worker disposed.");
            }
            runtimeModel = null;
        }
    }
}
