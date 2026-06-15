from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import uvicorn
import cv2
cv2.setNumThreads(4)
import numpy as np
import base64
import os
import sys
import time
import json
import hashlib
import secrets
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
import pymongo

# ──────────────────────────────────────────────────────────────
#  TruthLens PRO — AI Face Authenticity & Deepfake Detection
#  Author  : Prasan
#  Version : 3.0.0
#  Stack   : FastAPI + ONNX + ViT + YuNet + React
# ──────────────────────────────────────────────────────────────

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

print(f"DEBUG: Python version {sys.version}")

from utils.face_detection import FaceDetector
from utils.explain import get_explanation
from utils.local_ai_detector import detect_ai_image, detect_ai_video
from utils.advanced import analyze_frequency, get_head_pose

# ─── Liveness Detector ──────────────────────────────────────────────────────
ONNX_MODEL = os.path.join(current_dir, "models", "MiniFASNetV2_fast.onnx")
if os.path.exists(ONNX_MODEL):
    print("DEBUG: Using ONNX (Fast) Liveness Detector")
    from utils.liveness_onnx import LivenessDetectorONNX as LivenessDetector
    liveness_detector = LivenessDetector(ONNX_MODEL)
else:
    print("DEBUG: Using PyTorch Liveness Detector (slower)")
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
    description="AI-Powered Face Authenticity & Deepfake Detection System",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Auth System (MongoDB) ───────────────────────────────────────────────────

print("DEBUG: Connecting to Local MongoDB...")
try:
    mongo_client = pymongo.MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=2000)
    mongo_client.server_info() # Trigger connection check
    db = mongo_client["truthlens"]
    users_collection = db["users"]
    sessions_collection = db["sessions"]
    print("DEBUG: MongoDB Connected Successfully")
except Exception as e:
    print(f"CRITICAL: MongoDB Connection Failed. Ensure local MongoDB is running! Error: {e}")

def hash_password(password: str) -> str:
    salt = "truthlens_salt_v3"
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False))):
    if not credentials:
        return None
    token = credentials.credentials
    session = sessions_collection.find_one({"token": token})
    if session:
        return {"email": session["email"], "name": session["name"], "created_at": session["created_at"]}
    return None

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/auth/register")
async def register(req: RegisterRequest):
    if users_collection.find_one({"email": req.email}):
        raise HTTPException(status_code=409, detail="Email already registered")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    new_user = {
        "name": req.name,
        "email": req.email,
        "password_hash": hash_password(req.password),
        "created_at": time.time(),
        "scans": 0
    }
    users_collection.insert_one(new_user)

    # Auto-login after register
    token = secrets.token_hex(32)
    sessions_collection.insert_one({
        "token": token,
        "email": req.email,
        "name": req.name,
        "created_at": time.time()
    })

    return {"status": "success", "token": token, "name": req.name, "email": req.email}

@app.post("/auth/login")
async def login(req: LoginRequest):
    user = users_collection.find_one({"email": req.email})
    if not user or user.get("password_hash") != hash_password(req.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = secrets.token_hex(32)
    sessions_collection.insert_one({
        "token": token,
        "email": req.email,
        "name": user.get("name"),
        "created_at": time.time()
    })

    return {"status": "success", "token": token, "name": user.get("name"), "email": req.email}

@app.get("/auth/me")
async def me(user=Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"status": "success", "user": user}

@app.post("/auth/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False))):
    if credentials:
        sessions_collection.delete_one({"token": credentials.credentials})
    return {"status": "success"}

# ─── Core Analysis Pipeline ──────────────────────────────────────────────────

def analyze_frame(img: np.ndarray):
    """Core liveness pipeline: takes a BGR image, returns analysis dict."""
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

    # Silent-Face-Anti-Spoofing label mapping for this ONNX model:
    # Index 0 = Spoof type 1
    # Index 1 = Spoof type 2
    # Index 2 = Real/Live face
    if len(prediction) >= 3:
        score_real = float(prediction[2])   # Index 2 = Real
        score_fake = float(prediction[0] + prediction[1])  # 0+1 = all spoof types
    else:
        score_fake, score_real = float(prediction[0]), float(prediction[1])

    # FFT Moiré penalty for screen spoofs
    if freq_score > 165.0:
        score_real *= 0.5

    is_real = score_real > 0.65
    confidence = score_real if is_real else score_fake

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

# ─── Routes ──────────────────────────────────────────────────────────────────

class FrameRequest(BaseModel):
    image: str  # base64 data URL

@app.post("/analyze")
async def analyze_live(request: FrameRequest):
    """Live webcam frame liveness analysis."""
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
    """Static image upload liveness analysis."""
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
    """Video upload liveness analysis (frame-by-frame)."""
    try:
        contents = await file.read()
        tmp_path = os.path.join(current_dir, "tmp_video_upload.mp4")
        with open(tmp_path, "wb") as f:
            f.write(contents)

        cap = cv2.VideoCapture(tmp_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 24
        sample_every = max(1, int(fps))

        frame_results = []
        frame_idx = 0
        analyzed = 0
        MAX_FRAMES = 20

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
                f"Average liveness confidence score: {avg_conf*100:.1f}%"
            ]
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "3.0.0",
        "engine": "ONNX" if os.path.exists(ONNX_MODEL) else "PyTorch"
    }

@app.get("/stats")
async def stats():
    users = load_users()
    return {
        "total_users": len(users),
        "engine": "ONNX" if os.path.exists(ONNX_MODEL) else "PyTorch",
        "version": "3.0.0"
    }

# ─── AI Generation Detection Routes ─────────────────────────────────────────

@app.post("/detect-ai-image")
async def detect_ai_image_route(file: UploadFile = File(...)):
    """Detect if an uploaded photo is AI-generated using ViT model."""
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
        result["is_real"] = not result["is_ai"]
        result["threat_level"] = "AI GENERATED" if result["is_ai"] else "AUTHENTIC"
        result["reasons"] = [
            f"AI probability score: {result['scores']['ai']*100:.1f}%",
            f"Real/authentic probability: {result['scores']['real']*100:.1f}%",
            f"Verdict threshold: AI score must exceed 55% to flag as generated",
            "Detection model: umm-maybe/AI-image-detector (ViT fine-tuned)",
            "Trained to detect GAN, Diffusion, and other AI-generation artifacts"
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
        result = detect_ai_video(tmp_path, max_frames=12)
        try:
            os.remove(tmp_path)
        except:
            pass
        if "error" in result:
            return {"status": "error", "message": result["error"]}
        result["status"] = "success"
        result["is_real"] = not result["is_ai"]
        result["threat_level"] = "AI GENERATED" if result["is_ai"] else "AUTHENTIC"
        return result
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
