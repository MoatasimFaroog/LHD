# NomadGo SpatialVision — CI/CD Setup (GitHub Actions + GameCI)

## Overview
This project is configured to automatically build an Android APK using GitHub Actions and GameCI whenever you push code to the `main` branch.

---

## IMPORTANT: First Open in Unity

Before pushing to GitHub, you MUST open the project in Unity 2022.3 first. This generates correct GUIDs and meta files that GameCI needs:

1. Open Unity Hub
2. Click **Open** and select the project folder
3. Wait for Unity to import all assets (may take 5-10 minutes first time)
4. Go to **File > Build Settings** and verify `Main.unity` is in the scene list
5. Close Unity
6. Now the `ProjectSettings/` and `Packages/` folders contain valid auto-generated files

---

## Step 1: Push the Project to GitHub

### Option A: From PowerShell
```powershell
cd C:\Users\HP\Downloads\Nomad-Spatial-Vision

git init
git add .
git commit -m "Initial commit: NomadGo SpatialVision"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/NomadGo-SpatialVision.git
git push -u origin main
```

### Option B: Using GitHub Desktop
1. Open GitHub Desktop
2. File > Add Local Repository
3. Select the project folder
4. Publish to GitHub

---

## Step 2: Get Your Unity License

### Important: Updated Activation Process

⚠️ **The activation workflow has been updated.**

Please follow the official GameCI activation documentation for complete instructions:

🔗 **https://game.ci/docs/github/activation**

The documentation provides the latest instructions for:
- Getting your Unity license file (`.ulf`)
- Setting up GitHub secrets
- Activating Unity for CI/CD

### Quick Summary

After following the GameCI guide to obtain your Unity license file (`.ulf`):

1. Go to your repository: **Settings > Secrets and variables > Actions > New repository secret**
2. Add the license as `UNITY_LICENSE` secret (full contents of the `.ulf` file)
3. Add your `UNITY_EMAIL` (Unity account email)
4. Add your `UNITY_PASSWORD` (Unity account password)

---

## Step 3: Add GitHub Secrets

Go to your repository: **Settings > Secrets and variables > Actions > New repository secret**

Add these secrets:

| Secret Name | Value |
|---|---|
| `UNITY_LICENSE` | Full contents of the `.ulf` file |
| `UNITY_EMAIL` | Your Unity account email |
| `UNITY_PASSWORD` | Your Unity account password |

### Optional: For signed APK (needed for Google Play)

| Secret Name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded keystore (see below) |
| `ANDROID_KEYSTORE_PASS` | Keystore password |
| `ANDROID_KEYALIAS_NAME` | Key alias name |
| `ANDROID_KEYALIAS_PASS` | Key alias password |

#### Create a keystore (PowerShell):
```powershell
keytool -genkey -v -keystore nomadgo.keystore -alias nomadgo -keyalg RSA -keysize 2048 -validity 10000

# Convert to Base64:
[Convert]::ToBase64String([IO.File]::ReadAllBytes("nomadgo.keystore")) | Out-File keystore.base64.txt
```
Copy the contents of `keystore.base64.txt` into the `ANDROID_KEYSTORE_BASE64` secret.

---

## Step 4: Add Your ONNX Model

The YOLOv8n ONNX model is **not committed to the repository** (it is a binary weight file). You must supply it before a build can run inference. There are three supported approaches:

### Option A — Local build (add model directly)

1. Export the model from Ultralytics:
   ```bash
   pip install ultralytics
   python -m ultralytics export model=yolov8n.pt format=onnx imgsz=640
   ```
2. Import `yolov8n.onnx` into Unity (drag it into the Project window).
3. **Place it at `Assets/Resources/Models/yolov8n.onnx`** inside the Unity project.
4. Unity Sentis requires the file to be a **ModelAsset** — Unity automatically imports `.onnx` files as `ModelAsset` when placed in a project folder.

> ⚠️ Do **not** push the `.onnx` file to the repository — it is excluded by `.gitignore`.

### Option B — CI download via `YOLOV8N_ONNX_URL` secret (recommended for GitHub Actions)

Host `yolov8n.onnx` at a stable, authenticated URL (e.g. a GitHub Release asset, private S3 bucket, or other storage). Then:

1. Go to your repository: **Settings → Secrets and variables → Actions → New repository secret**
2. Add a secret named `YOLOV8N_ONNX_URL` with the full download URL as the value.

The CI workflows (`build-android.yml`, `build-unity-multiplatform.yml`) automatically download the model to `Assets/Resources/Models/yolov8n.onnx` before the Unity build step when this secret is present.

If `YOLOV8N_ONNX_URL` is **not** set, the build continues without the model — inference features will be disabled at runtime with a clear log message, but the APK itself will still be produced.

### Option C — Git LFS

If you prefer to store the model in the repository using [Git LFS](https://git-lfs.github.com/):

```bash
git lfs install
git lfs track "*.onnx"
git add .gitattributes
git add Assets/Resources/Models/yolov8n.onnx
git commit -m "Add yolov8n.onnx via Git LFS"
git push
```

The CI workflows already run `actions/checkout` with `lfs: true`, so the model will be pulled automatically.

---

## Step 5: Run the Build

### Automatic
The build runs automatically when you push to `main` (only when files in `Assets/`, `Packages/`, or `ProjectSettings/` change).

### Manual
1. Go to **Actions** tab
2. Click **Build Android APK**
3. Click **Run workflow** > **Run workflow**

---

## Step 6: Download the APK

1. After the build completes (usually 15-30 minutes), go to the **Actions** tab
2. Click the completed workflow run
3. Scroll down to **Artifacts**
4. Click **NomadGo-SpatialVision-APK** to download
5. Extract the ZIP
6. Transfer the `.apk` file to your Android phone
7. Install and run

---

## Workflow Files

| File | Purpose |
|---|---|
| `.github/workflows/activation.yml` | One-time: generates Unity license activation file |
| `.github/workflows/build-android.yml` | Builds Android APK on every push to main |

---

## Troubleshooting

### Build fails with "No valid Unity license"
- Make sure `UNITY_LICENSE` secret contains the FULL contents of the `.ulf` file
- Re-run the activation workflow if the license expired

### Build fails with "Scene not found"
- Verify `Assets/Scenes/Main.unity` exists
- Check `ProjectSettings/EditorBuildSettings.asset` lists the scene

### Build takes too long
- First build takes 20-40 minutes (caching is set up for subsequent builds)
- Subsequent builds should take 10-15 minutes

### APK crashes on device
- Make sure your device supports ARCore
- Check that the ONNX model is in `Assets/Resources/Models/` (see Step 4 above)
- Verify `Assets/Resources/CONFIG.json` has the correct model path (`"path": "Models/yolov8n.onnx"`)

### Build runs out of disk space
- The workflow includes automatic disk cleanup
- If it still fails, try reducing the project size or using a self-hosted runner
