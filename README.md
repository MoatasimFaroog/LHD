# NomadGo SpatialVision

> **Unity Mobile AR Application for 3D Spatial Intelligence Inventory Counting**

NomadGo SpatialVision is a full-stack AR inventory-counting suite. Point an Android device at a product shelf and the app automatically detects, tracks, and counts items using on-device AI — then streams live sync pulses to a cloud dashboard.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Mock Server API](#mock-server-api)
- [CI/CD](#cicd)
- [Configuration Reference](#configuration-reference)
- [Documentation](#documentation)

---

## Architecture Overview

```
NomadGo SpatialVision
├── 📱  Unity AR App         — Android mobile app (AR + YOLOv8 inference)
├── 🖥️  Mock Server          — Express.js sync-pulse receiver (port 5000)
├── 🌐  Web Dashboard        — React monitoring UI (served on port 5000)
└── ⚙️  CI/CD               — GitHub Actions + GameCI automated APK builds
```

### Unity AR App (`Assets/`)

| Module | Responsibility |
|---|---|
| `AppShell/` | App lifecycle, config loading, scan UI |
| `Spatial/` | AR plane detection, depth estimation, spatial tracking |
| `Vision/` | ONNX inference engine (YOLOv8), frame processing |
| `Counting/` | IOU tracker, row clustering, count management |
| `AROverlay/` | Bounding-box drawing, count labels, overlay renderer |
| `Storage/` | JSON session storage, auto-save, export |
| `Sync/` | Sync-pulse manager, retry queue, network monitor |
| `Diagnostics/` | FPS overlay, inference timer, memory monitor |

### Mock Server (`server/`)

Express.js server that receives sync pulses from the Unity app and exposes them via REST API and a React dashboard.

### Web Dashboard (`client/`)

React + Vite frontend for real-time pulse monitoring, stats, manual test tools, and API docs.

---

## Quick Start

### Run the Mock Server & Dashboard Locally

**Prerequisites:** Node.js 18+

```bash
# Install dependencies
npm install

# Start development server (hot-reload)
npm run dev

# Open the dashboard
open http://localhost:5000
```

### Run with Docker

```bash
# Build and start with Docker Compose (recommended)
docker compose up --build

# Or run the image directly
docker build -t nomadgo-spatialvision .
docker run -p 5000:5000 nomadgo-spatialvision
```

**Optional environment variables:**

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Port the server listens on |
| `NODE_ENV` | `production` | Runtime environment |

### Build the Unity Android App

1. Open the project in **Unity 2022.3 LTS** (URP template)
2. Install packages via Package Manager:
   - AR Foundation `5.1.2`
   - ARCore XR Plugin `5.1.2`
   - Unity Sentis `1.3.0`
3. Place your ONNX model at `Assets/Resources/Models/yolov8n.onnx`
4. **File → Build Settings → Android → Build**

See [`Docs/RUNBOOK.md`](Docs/RUNBOOK.md) for the full step-by-step setup guide.

### Build APK via GitHub Actions (no local Unity required)

1. Add the required secrets in **Settings → Secrets and variables → Actions** (see [CI/CD](#cicd))
2. Go to **Actions → Build Android APK → Run workflow**
3. Download the APK from **Artifacts** after ~15–30 minutes

---

## Project Structure

```
LHD/
├── Assets/                      # Unity project
│   ├── Scripts/                 # C# scripts (see modules above)
│   ├── Scenes/Main.unity        # Main AR scene
│   ├── Resources/CONFIG.json    # Runtime configuration
│   └── Models/                  # ONNX model + labels.txt
├── client/                      # React dashboard (Vite)
│   └── src/
├── server/                      # Express.js mock server
│   ├── index.ts
│   ├── routes.ts
│   └── storage.ts
├── shared/                      # Shared TypeScript types
├── .github/workflows/           # CI/CD pipelines
├── Docs/                        # Extended documentation
│   ├── RUNBOOK.md               # Full setup & troubleshooting guide
│   ├── CI_CD_SETUP.md           # CI/CD setup guide
│   ├── QA_CHECKLIST.md          # QA test matrix
│   └── OVERVIEW_AR.md           # Arabic overview
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## Mock Server API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/pulse` | Receive a sync pulse from the Unity app |
| `GET` | `/api/pulses` | List all received pulses |
| `GET` | `/api/stats` | Server statistics (count, last pulse…) |
| `GET` | `/api/health` | Health check |
| `DELETE` | `/api/pulses` | Clear all stored pulses |

**Example – send a test pulse:**

```bash
curl -X POST http://localhost:5000/api/pulse \
  -H "Content-Type: application/json" \
  -d '{
    "pulseId": "test001",
    "sessionId": "session_test",
    "timestamp": "2026-02-13T10:00:00Z",
    "totalCount": 25,
    "countsByLabel": [{"label":"bottle","count":10},{"label":"can","count":15}],
    "rowCount": 3,
    "deviceId": "test-device"
  }'
```

---

## CI/CD

GitHub Actions workflows (`.github/workflows/`):

| Workflow | Trigger | What it does |
|---|---|---|
| `build-android.yml` | Push to `main` | Builds Android APK via GameCI |
| `ci-nodejs.yml` | Push to `main` | Type-checks and builds the Node.js server |
| `build-web.yml` | Push to `main` | Builds the React frontend |
| `build-unity-multiplatform.yml` | Manual | Builds for Windows / Linux / WebGL |
| `activation.yml` | Manual | Generates Unity license activation file |

**Required repository secrets:**

| Secret | Purpose |
|---|---|
| `UNITY_LICENSE` | Unity license for automated builds |
| `UNITY_EMAIL` | Unity account e-mail |
| `UNITY_PASSWORD` | Unity account password |

See [`Docs/CI_CD_SETUP.md`](Docs/CI_CD_SETUP.md) for full setup instructions.

---

## Configuration Reference

`Assets/Resources/CONFIG.json` controls all runtime behaviour:

```json
{
  "model": {
    "path": "Models/yolov8n.onnx",
    "confidence_threshold": 0.45,
    "nms_threshold": 0.5,
    "max_detections": 100
  },
  "counting": {
    "iou_threshold": 0.4,
    "row_limit": 6
  },
  "sync": {
    "base_url": "https://YOUR_SERVER_URL",
    "pulse_interval_seconds": 5
  },
  "diagnostics": {
    "show_fps_overlay": true,
    "log_inference_time": true
  }
}
```

See the full reference table in [`Docs/RUNBOOK.md § CONFIG.json Reference`](Docs/RUNBOOK.md#7-configjson-reference).

---

## Documentation

| Doc | Description |
|---|---|
| [`Docs/RUNBOOK.md`](Docs/RUNBOOK.md) | Complete setup, build, and troubleshooting guide |
| [`Docs/CI_CD_SETUP.md`](Docs/CI_CD_SETUP.md) | Step-by-step CI/CD configuration |
| [`Docs/QA_CHECKLIST.md`](Docs/QA_CHECKLIST.md) | Full QA test matrix |
| [`Docs/OVERVIEW_AR.md`](Docs/OVERVIEW_AR.md) | Project overview in Arabic (نظرة عامة بالعربية) |
