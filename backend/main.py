from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import cv2
cv2.setNumThreads(4)
import numpy as np
import base64
import os
import sys
import time
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

# ──────────────────────────────────────────────────────────────
#  TruthLens PRO — AI Face Authenticity & Deepfake Detection
#  Author  : Prasan
#  Version : 2.0.0
#  Stack   : FastAPI + ONNX + ViT + YuNet + React
# ──────────────────────────────────────────────────────────────

# Load .env — this file is NOT in the GitHub repo
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
API_KEY = os.getenv("TRUTHLENS_API_KEY", "")

if not API_KEY:
    print("\n[ERROR] Missing TRUTHLENS_API_KEY in .env file.")
    print("[ERROR] Server cannot start. Contact the project owner.\n")
    sys.exit(1)

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

print(f"DEBUG: Python version {sys.version}")

from utils.face_detection import FaceDetector
from utils.explain import get_explanation
from utils.local_ai_detector import detect_ai_image, detect_ai_video
from utils.advanced import analyze_frequency, get_head_pose

# Try to use fast ONNX detector, fallback to PyTorch
ONNX_MODEL = os.path.join(current_dir, "models", "MiniFASNetV2_fast.onnx")
if os.path.exists(ONNX_MODEL):
    print("DEBUG: Using ONNX (Fast) Liveness Detector")
    from utils.liveness_onnx import LivenessDetectorONNX as LivenessDetector
    liveness_detector = LivenessDetector(ONNX_MODEL)
else:
    print("DEBUG: Using PyTorch Liveness Detector (slower - run convert_to_onnx.py to speed up)")
    from utils.liveness import LivenessDetector
    liveness_detector = LivenessDetector("models/2.7_80x80_MiniFASNetV2.pth")

print("DEBUG: Initializing Face Detector...")
try:
    face_detector = FaceDetector()
    print("DEBUG: Face Detector OK")
except Exception as e:
    print(f"CRITICAL: {e}")
    sys.exit(1)

app = FastAPI(
    title="TruthLens Pro API",
    description="AI-Powered Face Authenticity & Deepfake Detection System by Prasad",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Helpers ────────────────────────────────────────────────────────────────────

def analyze_frame(img: np.ndarray):
    """Core pipeline: takes a BGR image, returns analysis dict."""
    # Resize to 320p for speed
    h, w = img.shape[:2]
    if w > 320:
        scale = 320 / w
        img = cv2.resize(img, (320, int(h * scale)))

    faces = face_detector.detect(img)
    if not faces:
        return {"status": "error", "message": "No face detected"}

    x, y, w_f, h_f = faces[0]
    face_crop = face_detector.crop_face(img, (x, y, w_f, h_f))
    landmarks = face_detector.get_landmarks(img)

    start = time.time()
    prediction = liveness_detector.predict(face_crop)
    inference_ms = (time.time() - start) * 1000

    freq_score = analyze_frequency(face_crop)
    head_pose = get_head_pose(landmarks, img.shape)

    if len(prediction) >= 3:
        score_real = float(prediction[2])
        score_fake = float(prediction[0] + prediction[1])
    else:
        score_fake, score_real = float(prediction[0]), float(prediction[1])

    # FFT Moire penalty for screen spoofs
    if freq_score > 165.0:
        score_real *= 0.5

    is_real = score_real > 0.65
    confidence = score_real if is_real else score_fake
    
    # Threat level
    if score_real > 0.80:
        threat = "VERIFIED"
    elif score_real > 0.55:
        threat = "SUSPICIOUS"
    else:
        threat = "THREAT DETECTED"

    status_text, reasons = get_explanation(is_real, confidence)

    return {
        "status": "success",
        "is_real": is_real,
        "confidence": round(confidence, 4),
        "label": status_text,
        "threat_level": threat,
        "reasons": reasons,
        "bbox": {"x": int(x), "y": int(y), "w": int(w_f), "h": int(h_f)},
        "meta": {
            "inference_ms": round(inference_ms, 2),
            "frequency_fft": round(freq_score, 2),
            "pose_3d": head_pose,
            "engine": "ONNX+YuNet" if os.path.exists(ONNX_MODEL) else "PyTorch+YuNet",
            "timestamp": time.time(),
        }
    }

# ─── Routes ─────────────────────────────────────────────────────────────────────

class FrameRequest(BaseModel):
    image: str  # base64 data URL

@app.post("/analyze")
async def analyze_live(request: FrameRequest):
    """Live webcam frame analysis."""
    try:
        header, encoded = request.image.split(",", 1)
        data = base64.b64decode(encoded)
        nparr = np.frombuffer(data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return analyze_frame(img)
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    """Static image upload analysis."""
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return {"status": "error", "message": "Invalid image file"}
        return analyze_frame(img)
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/analyze-video")
async def analyze_video(file: UploadFile = File(...)):
    """
    Video upload analysis.
    Samples every 10th frame, analyzes each, returns aggregated verdict.
    """
    try:
        contents = await file.read()
        # Write to temp file (OpenCV needs a file path)
        tmp_path = os.path.join(current_dir, "tmp_video_upload.mp4")
        with open(tmp_path, "wb") as f:
            f.write(contents)

        cap = cv2.VideoCapture(tmp_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 24
        sample_every = max(1, int(fps))  # ~1 sample per second

        frame_results = []
        frame_idx = 0
        analyzed = 0
        MAX_FRAMES = 20  # Cap at 20 samples for speed

        while cap.isOpened() and analyzed < MAX_FRAMES:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % sample_every == 0:
                result = analyze_frame(frame)
                if result["status"] == "success":
                    frame_results.append({
                        "frame": frame_idx,
                        "is_real": result["is_real"],
                        "confidence": result["confidence"],
                        "threat_level": result["threat_level"]
                    })
                    analyzed += 1
            frame_idx += 1

        cap.release()
        try:
            os.remove(tmp_path)
        except:
            pass

        if not frame_results:
            return {"status": "error", "message": "No faces detected in video"}

        # Aggregate verdict
        avg_conf = sum(r["confidence"] for r in frame_results) / len(frame_results)
        real_count = sum(1 for r in frame_results if r["is_real"])
        is_real = real_count > len(frame_results) / 2
        threat = "VERIFIED" if avg_conf > 0.80 else ("SUSPICIOUS" if avg_conf > 0.55 else "THREAT DETECTED")

        return {
            "status": "success",
            "is_real": is_real,
            "confidence": round(avg_conf, 4),
            "threat_level": threat,
            "label": "AUTHENTIC" if is_real else "DEEPFAKE / SPOOF",
            "frames_analyzed": len(frame_results),
            "total_frames": total_frames,
            "frame_results": frame_results,
            "reasons": [
                f"Analyzed {len(frame_results)} key frames from the video",
                f"{real_count} frames classified as authentic, {len(frame_results)-real_count} as spoofed",
                f"Average confidence score: {avg_conf*100:.1f}%"
            ]
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/health")
async def health():
    return {"status": "ok", "engine": "ONNX" if os.path.exists(ONNX_MODEL) else "PyTorch"}

# ─── AI Generation Detection Routes ─────────────────────────────────────────

@app.post("/detect-ai-image")
async def detect_ai_image_route(file: UploadFile = File(...)):
    """Detect if an uploaded photo is AI-generated."""
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return {"status": "error", "message": "Invalid image file"}
        result = detect_ai_image(img)
        if "error" in result:
            return {"status": "error", "message": result["error"]}
        result["status"] = "success"
        result["threat_level"] = "AI GENERATED" if result["is_ai"] else "AUTHENTIC"
        result["reasons"] = [
            f"AI probability score: {result['scores']['ai']*100:.1f}%",
            f"Real/authentic probability: {result['scores']['real']*100:.1f}%",
            "Detection model: HuggingFace AI-image-detector (umm-maybe)",
            "Trained to distinguish GAN, Diffusion, and real photography"
        ]
        return result
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/detect-ai-video")
async def detect_ai_video_route(file: UploadFile = File(...)):
    """Detect if an uploaded video is AI-generated by sampling frames."""
    try:
        contents = await file.read()
        tmp_path = os.path.join(current_dir, "tmp_ai_video.mp4")
        with open(tmp_path, "wb") as f:
            f.write(contents)
        result = detect_ai_video(tmp_path, max_frames=8)
        try:
            os.remove(tmp_path)
        except:
            pass
        if "error" in result:
            return {"status": "error", "message": result["error"]}
        result["status"] = "success"
        result["threat_level"] = "AI GENERATED" if result["is_ai"] else "AUTHENTIC"
        result["is_real"] = not result["is_ai"]
        return result
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
