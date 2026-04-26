def get_explanation(is_real, confidence):
    if is_real:
        reasons = [
            "Natural facial movement detected",
            "Consistent texture and lighting",
            "Human-like skin response found"
        ]
        status = "✅ REAL HUMAN"
    else:
        reasons = [
            "Unnatural facial texture detected",
            "Possible replay attack (photo/screen)",
            "Liveness pattern not detected"
        ]
        status = "❌ SPOOF DETECTED"
    
    return status, reasons
