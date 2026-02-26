using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Unity.Sentis;

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
            // Load from Resources. Expected path relative to Resources folder, without extension.
            string resourcePath = labelsPath.Replace(".txt", "");
            TextAsset labelsAsset = Resources.Load<TextAsset>(resourcePath);

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
                // Load as a ModelAsset from Resources (Unity Sentis uses ModelAsset instead of NNModel)
                string assetName = System.IO.Path.GetFileNameWithoutExtension(modelPath);
                ModelAsset modelAsset = Resources.Load<ModelAsset>(assetName);
                if (modelAsset == null)
                {
                    modelAsset = Resources.Load<ModelAsset>(modelPath.Replace(".onnx", "").Replace("Models/", ""));
                }

                if (modelAsset != null)
                {
                    runtimeModel = ModelLoader.Load(modelAsset);
                    worker = WorkerFactory.CreateWorker(BackendType.CPU, runtimeModel);
                    isLoaded = true;
                    Debug.Log($"[ONNXEngine] Model loaded from Resources: {modelAsset.name}");
                    return;
                }

                Debug.LogError(
                    $"[ONNXEngine] Model asset not found for path \"{modelPath}\". " +
                    "Export yolov8n.onnx with: python -m ultralytics export model=yolov8n.pt format=onnx imgsz=640 " +
                    "then import it into Unity and place it under Assets/Resources/Models/ as a ModelAsset. " +
                    "Inference features are disabled until the model is present."
                );
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

            TensorFloat inputTensor = PreprocessFrame(frame);
            worker.Execute(inputTensor);
            inputTensor.Dispose();

            TensorFloat output = worker.PeekOutput() as TensorFloat;
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

        private TensorFloat PreprocessFrame(Texture2D frame)
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

            // Sentis uses NCHW format: [batch=1, channels=3, height, width]
            float[] data = new float[3 * inputHeight * inputWidth];
            int channelStride = inputHeight * inputWidth;
            for (int y = 0; y < inputHeight; y++)
            {
                for (int x = 0; x < inputWidth; x++)
                {
                    int idx = y * inputWidth + x;
                    data[0 * channelStride + y * inputWidth + x] = pixels[idx].r;
                    data[1 * channelStride + y * inputWidth + x] = pixels[idx].g;
                    data[2 * channelStride + y * inputWidth + x] = pixels[idx].b;
                }
            }

            return new TensorFloat(new TensorShape(1, 3, inputHeight, inputWidth), data);
        }

        private List<DetectionResult> ParseOutput(TensorFloat output, int originalWidth, int originalHeight)
        {
            var detections = new List<DetectionResult>();

            if (output == null)
            {
                Debug.LogError("[ONNXEngine] Output tensor is null.");
                return detections;
            }

            try
            {
                float scaleX = (float)originalWidth / inputWidth;
                float scaleY = (float)originalHeight / inputHeight;
                int numClasses = labels.Length;

                // YOLOv8 ONNX output: [1, 4+numClasses, numAnchors] (NCHW)
                // Dimension 0 = batch, Dimension 1 = features (4 bbox + numClasses), Dimension 2 = anchors
                var shape = output.shape;
                if (shape.rank < 3)
                {
                    Debug.LogError($"[ONNXEngine] Unexpected output tensor rank: {shape.rank}");
                    return detections;
                }

                const int featureDim = 1;
                const int anchorDim = 2;
                int numDetections = shape[anchorDim]; // numAnchors
                int rowSize = shape[featureDim];      // 4+numClasses

                // In Sentis 1.3.0, TensorFloat doesn't support 3D indexing directly.
                // Download to CPU once for efficiency.
                float[] outputData = output.ToReadOnlyArray();

                for (int i = 0; i < numDetections; i++)
                {
                    // YOLOv8 output format: [1, 4 + numClasses, numAnchors]
                    // Indexing into flattened array: batch * rowSize * numDetections + featureIndex * numDetections + anchorIndex
                    float cx = outputData[0 * rowSize * numDetections + 0 * numDetections + i];
                    float cy = outputData[0 * rowSize * numDetections + 1 * numDetections + i];
                    float w  = outputData[0 * rowSize * numDetections + 2 * numDetections + i];
                    float h  = outputData[0 * rowSize * numDetections + 3 * numDetections + i];

                    float bestConf = 0f;
                    int bestClass = -1;

                    for (int c = 0; c < numClasses && (c + 4) < rowSize; c++)
                    {
                        float conf = outputData[0 * rowSize * numDetections + (4 + c) * numDetections + i];
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
