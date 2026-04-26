import requests
import cv2
import numpy as np
import io
import os
from PIL import Image

# HuggingFace model: detects if an image is AI-generated or real
HF_API_URL = "https://api-inference.huggingface.co/models/umm-maybe/AI-image-detector"

# Optional: set HF_TOKEN in a .env file for higher rate limits
# Without token, it still works but may be slower on first call (model loading)
HF_TOKEN = os.getenv("HF_TOKEN", "")

def _get_headers():
    if HF_TOKEN:
        return {"Authorization": f"Bearer {HF_TOKEN}"}
    return {}

def _call_hf_api(image_bytes: bytes) -> dict:
    """Call HuggingFace Inference API and return result dict."""
    response = requests.post(
        HF_API_URL,
        headers=_get_headers(),
        data=image_bytes,
        timeout=30
    )
    if response.status_code == 503:
        # Model is loading, retry once after short wait
        import time
        time.sleep(3)
        response = requests.post(
            HF_API_URL,
            headers=_get_headers(),
            data=image_bytes,
            timeout=30
        )
    response.raise_for_status()
    return response.json()

def _cv2_to_jpeg_bytes(img: np.ndarray) -> bytes:
    """Convert OpenCV image to JPEG bytes for the API."""
    pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()

def detect_ai_image(img: np.ndarray) -> dict:
    """
    Analyze a single image frame.
    Returns: { is_ai: bool, confidence: float, label: str, scores: dict }
    """
    try:
        img_bytes = _cv2_to_jpeg_bytes(img)
        results = _call_hf_api(img_bytes)

        # Results: [{"label": "artificial", "score": 0.95}, {"label": "natural", "score": 0.05}]
        scores = {r["label"]: r["score"] for r in results}
        ai_score = scores.get("artificial", scores.get("AI", 0))
        real_score = scores.get("natural", scores.get("real", 0))

        is_ai = ai_score > real_score
        confidence = ai_score if is_ai else real_score

        return {
            "is_ai": is_ai,
            "confidence": round(confidence, 4),
            "label": "AI GENERATED" if is_ai else "AUTHENTIC",
            "scores": {"ai": round(ai_score, 4), "real": round(real_score, 4)}
        }
    except Exception as e:
        return {"error": str(e)}

def detect_ai_video(video_path: str, max_frames: int = 10) -> dict:
    """
    Sample frames from a video and analyze each one.
    Returns aggregated verdict.
    """
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    sample_every = max(1, int(fps))  # 1 sample per second

    frame_results = []
    frame_idx = 0
    analyzed = 0

    while cap.isOpened() and analyzed < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % sample_every == 0:
            result = detect_ai_image(frame)
            if "error" not in result:
                frame_results.append({
                    "frame": frame_idx,
                    "is_ai": result["is_ai"],
                    "confidence": result["confidence"],
                    "label": result["label"]
                })
                analyzed += 1
        frame_idx += 1

    cap.release()

    if not frame_results:
        return {"error": "Could not analyze any frames"}

    avg_ai_conf = sum(r["confidence"] for r in frame_results if r["is_ai"]) / max(1, len([r for r in frame_results if r["is_ai"]]))
    ai_count = sum(1 for r in frame_results if r["is_ai"])
    is_ai = ai_count > len(frame_results) / 2

    avg_conf = sum(r["confidence"] for r in frame_results) / len(frame_results)

    return {
        "is_ai": is_ai,
        "confidence": round(avg_conf, 4),
        "label": "AI GENERATED" if is_ai else "AUTHENTIC",
        "frames_analyzed": len(frame_results),
        "total_frames": total_frames,
        "ai_frames": ai_count,
        "real_frames": len(frame_results) - ai_count,
        "frame_results": frame_results,
        "reasons": [
            f"Analyzed {len(frame_results)} sampled frames from the video",
            f"{ai_count} frames flagged as AI-generated, {len(frame_results)-ai_count} as authentic",
            f"Average AI probability: {avg_conf*100:.1f}%",
            "Detection powered by HuggingFace AI-image-detector model"
        ]
    }
