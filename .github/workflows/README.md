# GitHub Actions Workflows for Unity Builder

This directory contains GitHub Actions workflows for building the NomadGo SpatialVision Unity project.

## Available Workflows

### 1. `activation.yml` - Unity License Activation
**Trigger:** Manual (`workflow_dispatch`)

This workflow generates a Unity license activation file (`.alf`) that you need to activate your Unity license for CI/CD.

**Steps to use:**
1. Go to your repository's **Actions** tab
2. Select "Acquire Unity License" workflow
3. Click "Run workflow"
4. Download the generated `.alf` artifact
5. Upload it to https://license.unity3d.com/manual
6. Download the `.ulf` license file
7. Add the contents as `UNITY_LICENSE` secret in repository settings

**Required once:** This only needs to be run once initially or when the license expires.

### 2. `build-android.yml` - Build Android APK
**Triggers:**
- Push to `main` branch (when files in `Assets/`, `Packages/`, or `ProjectSettings/` change)
- Pull requests to `main` branch
- Manual (`workflow_dispatch`)

This workflow automatically builds an Android APK using Unity Builder.

**Features:**
- Caches Unity Library for faster builds
- Frees disk space automatically
- Builds signed or unsigned APKs
- Uploads APK as artifact (retained for 14 days)

**Build time:**
- First build: ~20-40 minutes
- Subsequent builds: ~10-15 minutes (with caching)

## Required Secrets

Before the build workflow can run successfully, add these secrets in **Settings > Secrets and variables > Actions**:

### Essential Secrets (Required)
- `UNITY_LICENSE` - Full contents of the `.ulf` license file from Unity
- `UNITY_EMAIL` - Your Unity account email
- `UNITY_PASSWORD` - Your Unity account password

### Optional Secrets (For Signed APKs)
- `ANDROID_KEYSTORE_BASE64` - Base64-encoded Android keystore
- `ANDROID_KEYSTORE_PASS` - Keystore password
- `ANDROID_KEYALIAS_NAME` - Key alias name
- `ANDROID_KEYALIAS_PASS` - Key alias password

## Unity Version

The workflows are configured for **Unity 2022.3.22f1**. Make sure this matches your project's Unity version in `ProjectSettings/ProjectVersion.txt`.

## Artifacts

After a successful build, the APK will be available as an artifact named `LHD-APK` in the workflow run. Download it from:
1. Go to **Actions** tab
2. Click on the completed workflow run
3. Scroll to **Artifacts** section
4. Click **LHD-APK** to download

## Troubleshooting

### Build fails with "No valid Unity license"
- Verify `UNITY_LICENSE` secret contains the complete `.ulf` file contents
- Re-run the activation workflow if the license expired

### Build fails with "Scene not found"
- Ensure `Assets/Scenes/Main.unity` exists
- Check that it's listed in `ProjectSettings/EditorBuildSettings.asset`

### Build runs out of disk space
- The workflow includes automatic cleanup, but very large projects may still fail
- Consider using a self-hosted runner with more disk space

### APK won't install on device
- Enable "Install from Unknown Sources" in your Android device settings
- For Google Play distribution, you need to provide keystore secrets for signed APKs

## Documentation

For detailed setup instructions, see:
- `/Docs/CI_CD_SETUP.md` - Complete CI/CD setup guide
- `/replit.md` - Project overview and architecture
- `/Docs/RUNBOOK.md` - Setup and troubleshooting guide
