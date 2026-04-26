"""
Run this ONCE to convert MiniFASNetV2 PyTorch weights to ONNX.
This makes inference 3-5x faster using OnnxRuntime instead of PyTorch.
"""
import io
import os
import sys

# Fix Windows console encoding for torch.onnx emoji output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import torch

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from utils.silent_face.model_lib.MiniFASNet import MiniFASNetV2
from utils.silent_face.utility import get_kernel, parse_model_name

MODEL_PATH = "models/2.7_80x80_MiniFASNetV2.pth"
ONNX_OUTPUT = "models/MiniFASNetV2_fast.onnx"

def convert():
    model_name = os.path.basename(MODEL_PATH)
    h_input, w_input, model_type, _ = parse_model_name(model_name)
    kernel_size = get_kernel(h_input, w_input)

    model = MiniFASNetV2(conv6_kernel=kernel_size)
    state_dict = torch.load(MODEL_PATH, map_location="cpu")
    new_state_dict = {k[7:] if k.startswith("module.") else k: v for k, v in state_dict.items()}
    model.load_state_dict(new_state_dict)
    model.eval()

    dummy_input = torch.randn(1, 3, h_input, w_input)

    torch.onnx.export(
        model,
        dummy_input,
        ONNX_OUTPUT,
        export_params=True,
        opset_version=18,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["output"],
    )
    print(f"✅ ONNX model saved to: {ONNX_OUTPUT}")

if __name__ == "__main__":
    convert()
