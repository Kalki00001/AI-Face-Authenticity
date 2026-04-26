"""
Local AI-Generated Image Detector
Uses a pre-trained ViT model downloaded once and cached locally.
No internet needed after first run.
Model: umm-maybe/AI-image-detector (fine-tuned for AI vs Real image classification)
"""
import cv2
import numpy as np
from PIL import Image
import time

# Lazy-loaded model (loads only when first image is analyzed, not at server startup)
_pipeline = None

def _get_pipeline():
    global _pipeline
    if _pipeline is None:
        print("DEBUG: Loading AI-image-detector model (first run, downloading ~300MB to cache)...")
        from transformers import pipeline
        _pipeline = pipeline(
            "image-classification",
            model="umm-maybe/AI-image-detector",
            device=-1  # -1 = CPU, 0 = first GPU (we use CPU)
        )
        print("DEBUG: AI-image-detector model ready!")
    return _pipeline

def _cv2_to_pil(img: np.ndarray) -> Image.Image:
    """Convert OpenCV BGR image to PIL RGB."""
    return Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))

def detect_ai_image(img: np.ndarray) -> dict:
    """
    Analyze a single image.
    Returns: { is_ai, confidence, label, scores }
    """
    try:
        pipe = _get_pipeline()
        pil_img = _cv2_to_pil(img)

        start = time.time()
        results = pipe(pil_img, top_k=2)
        elapsed = (time.time() - start) * 1000

        # Results: [{"label": "artificial", "score": 0.95}, {"label": "natural", "score": 0.05}]
        scores = {r["label"]: r["score"] for r in results}
        ai_score = scores.get("artificial", scores.get("AI", 0.0))
        real_score = scores.get("natural", scores.get("real", 0.0))

        is_ai = ai_score > real_score
        confidence = ai_score if is_ai else real_score

        return {
            "is_ai": is_ai,
            "confidence": round(confidence, 4),
            "label": "AI GENERATED" if is_ai else "AUTHENTIC",
            "inference_ms": round(elapsed, 2),
            "scores": {
                "ai": round(ai_score, 4),
                "real": round(real_score, 4)
            }
        }
    except Exception as e:
        return {"error": str(e)}

def detect_ai_video(video_path: str, max_frames: int = 8) -> dict:
    """
    Sample frames from a video, analyze each with the local model.
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
            f"Analyzed {len(frame_results)} key frames from video ({total_frames} total frames)",
            f"{ai_count} frames flagged as AI-generated, {len(frame_results) - ai_count} as authentic",
            f"Average AI probability score: {avg_conf * 100:.1f}%",
            "Local model: umm-maybe/AI-image-detector (ViT fine-tuned on AI vs Real dataset)"
        ]
    }
