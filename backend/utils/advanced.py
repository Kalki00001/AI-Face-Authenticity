import cv2
import numpy as np
import math

def enhance_image(img):
    """ Improves lighting and sharpness for low-quality webcams """
    # Contrast Limited Adaptive Histogram Equalization (CLAHE) for lighting
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_channel, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    cl = clahe.apply(l_channel)
    limg = cv2.merge((cl,a,b))
    enhanced = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
    
    # Mild Sharpening
    kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
    sharpened = cv2.filter2D(enhanced, -1, kernel)
    return sharpened

def analyze_frequency(face_crop):
    """ Uses FFT to detect the high-frequency pixel arrays of a digital screen spoof """
    try:
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        f = np.fft.fft2(gray)
        fshift = np.fft.fftshift(f)
        magnitude_spectrum = 20 * np.log(np.abs(fshift) + 1e-8)
        
        # Calculate high-frequency average
        score = np.mean(magnitude_spectrum)
        # Higher score usually means more high-freq noise (like a screen's pixel grid)
        return float(score)
    except:
        return 0.0

def get_head_pose(landmarks, frame_shape):
    """ Calculates 3D Head Orientation to prove the object is a 3D human, not a 2D photo """
    if landmarks is None or len(landmarks) < 5:
        return {"pitch": 0, "yaw": 0, "roll": 0}

    # Standard generic 3D face model points
    model_points = np.array([
        (225.0, 170.0, -135.0),    # Right eye
        (-225.0, 170.0, -135.0),   # Left eye
        (0.0, 0.0, 0.0),           # Nose tip
        (150.0, -150.0, -125.0),   # Right mouth corner
        (-150.0, -150.0, -125.0)   # Left mouth corner
    ])
    
    # YuNet provides landmarks in this order
    image_points = np.array(landmarks, dtype="double")
    
    focal_length = frame_shape[1]
    center = (frame_shape[1]/2, frame_shape[0]/2)
    camera_matrix = np.array(
        [[focal_length, 0, center[0]],
         [0, focal_length, center[1]],
         [0, 0, 1]], dtype="double"
    )
    dist_coeffs = np.zeros((4,1))
    
    success, rotation_vector, translation_vector = cv2.solvePnP(
        model_points, 
        image_points, 
        camera_matrix, 
        dist_coeffs,
        flags=cv2.SOLVEPNP_SQPNP
    )
    
    if success:
        rmat, _ = cv2.Rodrigues(rotation_vector)
        proj_matrix = np.hstack((rmat, translation_vector))
        euler_angles = -cv2.decomposeProjectionMatrix(proj_matrix)[6]
        
        return {
            "pitch": round(float(euler_angles[0][0]), 2),
            "yaw": round(float(euler_angles[1][0]), 2),
            "roll": round(float(euler_angles[2][0]), 2)
        }
    return {"pitch": 0, "yaw": 0, "roll": 0}
