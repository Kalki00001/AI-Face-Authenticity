# TruthLens PRO — AI Face Authenticity System

A real-time, multi-modal AI system for:
- **Live Face Anti-Spoofing** (detects photo/screen replay attacks on camera)
- **AI Image Detection** (detects if a photo is AI-generated)
- **AI Video Detection** (samples frames, detects deepfake/AI-generated video)

## Tech Stack
- **Backend**: FastAPI + Python 3.13
- **Live AI Engine**: MiniFASNetV2 (ONNX, runs locally, ~40ms/frame)
- **Photo/Video AI Engine**: `umm-maybe/AI-image-detector` (ViT, downloads once ~300MB, then fully offline)
- **Face Detection**: YuNet (OpenCV DNN)
- **Frontend**: React + Vite + Tailwind + Framer Motion

---

## Setup (First Time)

### 1. Clone the repo
```bash
git clone <your-repo-url>
cd AI-Face-Authenticity
```

### 2. Backend Setup
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Download AI Model Weights (one-time)
The MiniFASNet ONNX model is NOT in the repo (too large for GitHub).
Run this once to generate it:
```powershell
python convert_to_onnx.py
```
This creates `backend/models/MiniFASNetV2_fast.onnx`.

> The Photo/Video AI model (`umm-maybe/AI-image-detector`) downloads automatically on first use from HuggingFace and is cached at `C:\Users\<you>\.cache\huggingface\`.

### 4. Start the Backend
```powershell
python main.py
```

### 5. Frontend Setup (new terminal)
```powershell
cd frontend
npm install
npm run dev
```

### 6. Open the app
Navigate to: http://localhost:5173

---

## Features
| Mode | What it does |
|------|-------------|
| 🎥 LIVE | Real-time face liveness check via webcam |
| 📷 PHOTO | Upload any image → AI or Real verdict |
| 🎞️ VIDEO | Upload video → frame-by-frame AI detection |

---

## Project Size
| Component | Size |
|-----------|------|
| Source code | ~18 MB |
| `venv/` (Python deps) | ~2.5 GB (not in GitHub) |
| `node_modules/` | ~300 MB (not in GitHub) |
| ONNX model (generated locally) | ~260 KB |
| HuggingFace AI model (cached) | ~300 MB (not in project folder) |

**GitHub repo size: ~18 MB only**
