import cv2
import numpy as np
import os

class FaceDetector:
    def __init__(self, model_path="assets/face_detection_yunet_2023mar.onnx"):
        if not os.path.exists(model_path):
            # Fallback will be handled in main.py or we can try to download here
            # But we already have a curl command running
            print(f"Warning: YuNet model not found at {model_path}. Detection may fail.")
        
        self.detector = cv2.FaceDetectorYN.create(
            model=model_path,
            config="",
            input_size=(320, 320),
            score_threshold=0.8,
            nms_threshold=0.3,
            top_k=5000
        )

    def detect(self, frame):
        h, w, _ = frame.shape
        self.detector.setInputSize((w, h))
        ret, faces = self.detector.detect(frame)
        
        results = []
        if faces is not None:
            for face in faces:
                # face format: [x, y, w, h, x_re, y_re, x_le, y_le, x_nt, y_nt, x_rm, y_rm, x_lm, y_lm, score]
                bbox = face[0:4].astype(int)
                results.append(list(bbox))
        return results

    def get_landmarks(self, frame):
        # YuNet provides 5 landmarks
        h, w, _ = frame.shape
        self.detector.setInputSize((w, h))
        ret, faces = self.detector.detect(frame)
        if faces is not None:
            # We return the landmarks for the first face
            return faces[0][4:14].reshape(5, 2)
        return None

    def crop_face(self, frame, bbox):
        x, y, w, h = bbox
        margin = int(0.2 * w)
        x1 = max(0, x - margin)
        y1 = max(0, y - margin)
        x2 = min(frame.shape[1], x + w + margin)
        y2 = min(frame.shape[0], y + h + margin)
        return frame[y1:y2, x1:x2]

    def calculate_ear(self, landmarks):
        # YuNet only has 5 points (eyes, nose, mouth corners)
        # EAR calculation is not possible as we don't have 6 eye landmarks.
        # We can implement a simplified "Eye Movement" or "Pulse" check in the future.
        return 0.25 # Mock value for now
