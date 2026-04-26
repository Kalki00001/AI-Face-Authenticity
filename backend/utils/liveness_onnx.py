import os
import numpy as np
import cv2
import onnxruntime as ort

class LivenessDetectorONNX:
    """
    Ultra-fast ONNX-based liveness detector.
    3-5x faster than PyTorch on CPU.
    Uses OnnxRuntime with full graph optimizations enabled.
    """
    def __init__(self, onnx_path="models/MiniFASNetV2_fast.onnx"):
        # ORT Session with maximum CPU optimizations
        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        opts.intra_op_num_threads = 4
        opts.inter_op_num_threads = 2

        self.session = ort.InferenceSession(
            onnx_path,
            sess_options=opts,
            providers=["CPUExecutionProvider"]
        )
        self.input_name = self.session.get_inputs()[0].name
        self.input_h = self.session.get_inputs()[0].shape[2]  # e.g., 80
        self.input_w = self.session.get_inputs()[0].shape[3]  # e.g., 80

        # Warmup for max speed from frame 1
        dummy = np.zeros((1, 3, self.input_h, self.input_w), dtype=np.float32)
        self.session.run(None, {self.input_name: dummy})
        print(f"DEBUG: ONNX Liveness Detector ready ({self.input_h}x{self.input_w})")

    def predict(self, face_img):
        """Returns softmax probabilities. Index 2 = Real, 0+1 = Spoof types."""
        # Resize face to model input size
        resized = cv2.resize(face_img, (self.input_w, self.input_h))
        
        # Convert BGR → RGB, normalize to [0,1], to CHW
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        chw = np.transpose(rgb, (2, 0, 1))
        batch = np.expand_dims(chw, axis=0)  # (1, 3, H, W)
        
        output = self.session.run(None, {self.input_name: batch})[0][0]
        
        # Apply softmax
        e = np.exp(output - np.max(output))
        return e / e.sum()
