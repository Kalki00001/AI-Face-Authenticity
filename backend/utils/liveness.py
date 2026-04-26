import os
import sys
import torch
import numpy as np
import cv2
import torch.nn.functional as F

# Force torch to run optimized for CPU inference speed on Windows
torch.set_num_threads(4) 
torch.set_grad_enabled(False)

# Add silent_face to path to handle internal imports
current_dir = os.path.dirname(os.path.abspath(__file__))
silent_face_path = os.path.join(current_dir, "silent_face")
sys.path.append(silent_face_path)

from utils.silent_face.model_lib.MiniFASNet import MiniFASNetV1SE, MiniFASNetV2
from utils.silent_face.data_io import transform as trans
from utils.silent_face.utility import get_kernel, parse_model_name

class LivenessDetector:
    def __init__(self, model_path="models/2.7_80x80_MiniFASNetV2.pth"):
        self.device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        self.model_path = model_path
        self.model = self._load_model(model_path)
        self.model.eval()

    def _load_model(self, model_path):
        model_name = os.path.basename(model_path)
        h_input, w_input, model_type, _ = parse_model_name(model_name)
        self.kernel_size = get_kernel(h_input, w_input)
        
        # Mapping model types
        if 'MiniFASNetV2' in model_type:
            model = MiniFASNetV2(conv6_kernel=self.kernel_size).to(self.device)
        else:
            model = MiniFASNetV1SE(conv6_kernel=self.kernel_size).to(self.device)

        state_dict = torch.load(model_path, map_location=self.device)
        
        # Filter 'module.' prefix if present
        new_state_dict = {}
        for k, v in state_dict.items():
            name = k[7:] if k.startswith('module.') else k
            new_state_dict[name] = v
            
        model.load_state_dict(new_state_dict)
        return model

    def predict(self, face_img):
        # Image preprocessing
        # Silent Face expects specific size (e.g., 80x80)
        h_input, w_input, _, _ = parse_model_name(os.path.basename(self.model_path))
        face_img = cv2.resize(face_img, (w_input, h_input))
        
        test_transform = trans.Compose([
            trans.ToTensor(),
        ])
        img = test_transform(face_img)
        img = img.unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            result = self.model.forward(img)
            result = F.softmax(result, dim=1).cpu().numpy()
        
        # result[0] = [score_for_fake, score_for_real]
        # In Silent Face repo, label 1 is REAL, label 0 is FAKE (usually)
        # However, checking the repo logic:
        # label = np.argmax(prediction)
        # value = prediction[0][label]
        return result[0]
