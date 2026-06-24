FROM python:3.13-slim

WORKDIR /app

# Install system dependencies required for OpenCV
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create cache directory for HuggingFace models
RUN mkdir -p /.cache/huggingface && chmod 777 /.cache/huggingface

# Copy the rest of the application
COPY . .

# Expose the port Hugging Face Spaces uses (7860)
EXPOSE 7860

# Run FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
