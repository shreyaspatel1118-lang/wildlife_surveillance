# -*- coding: utf-8 -*-
"""
Flask API for YOLO image inference.
Receives images from Express backend, runs detection, returns annotated images + JSON.
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import json
import base64
import cv2
from datetime import datetime
import time
from io import BytesIO

# Import existing inference utilities
from inference_utils import decode_image_bytes, run_detection

app = Flask(__name__)
CORS(app)  # Enable CORS for Express backend

# Directories for output
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(os.path.dirname(SCRIPTS_DIR), "output_evidence")
os.makedirs(OUTPUT_DIR, exist_ok=True)

LATEST_JSON = os.path.join(OUTPUT_DIR, "latest.json")
LATEST_ANNOTATED_JPG = os.path.join(OUTPUT_DIR, "latest_annotated.jpg")


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()})


@app.route("/detect", methods=["POST"])
def detect():
    """
    Receive image from Express backend and run YOLO detection.
    
    Expected: RAW image bytes in request body
    Returns: JSON with detections + base64 annotated image
    """
    try:
        # Get image bytes from request
        image_bytes = request.get_data()

        if not image_bytes:
            return jsonify({"error": "No image data received"}), 400

        # Decode image
        image = decode_image_bytes(image_bytes)

        # Run detection with timing logs
        t_start = time.time()
        print(f"[detect] Starting detection at {datetime.now().isoformat()}")
        result = run_detection(image, conf=0.30, iou=0.45, imgsz=640)
        t_end = time.time()
        print(f"[detect] Detection finished in {t_end - t_start:.2f}s")

        if result.error:
            # Log detection error for debugging
            print(f"Detection returned error: {result.error}")
            return jsonify({"error": result.error}), 400

        # Convert annotated image to JPEG bytes
        import cv2
        success, annotated_jpg = cv2.imencode(".jpg", result.annotations)

        if not success:
            return jsonify({"error": "Failed to encode annotated image"}), 500

        annotated_bytes = annotated_jpg.tobytes()

        # Save annotated image
        with open(LATEST_ANNOTATED_JPG, "wb") as f:
            f.write(annotated_bytes)

        # Prepare response
        response_data = {
            "timestamp": datetime.now().isoformat(),
            "detections": result.detections,
            "class_names": result.names,
            "detection_count": len(result.detections),
            "human_detected": result.human_detected,
            "detection_mode": result.detection_mode,
            "annotated_image": base64.b64encode(annotated_bytes).decode("utf-8"),
        }

        # Save to JSON file
        with open(LATEST_JSON, "w") as f:
            json.dump(response_data, f, indent=2)

        print(f"[detect] Saved latest.json and annotated image — detections={len(result.detections)}")
        return jsonify(response_data), 200

    except Exception as e:
        print(f"Error during detection: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/latest-annotated", methods=["GET"])
def get_latest_annotated():
    """Serve the latest annotated image."""
    if os.path.exists(LATEST_ANNOTATED_JPG):
        return send_file(LATEST_ANNOTATED_JPG, mimetype="image/jpeg")
    return jsonify({"error": "No annotated image available"}), 404


@app.route("/latest-json", methods=["GET"])
def get_latest_json():
    """Serve the latest detection results."""
    if os.path.exists(LATEST_JSON):
        with open(LATEST_JSON, "r") as f:
            return jsonify(json.load(f))
    return jsonify({"error": "No detection results available"}), 404


if __name__ == "__main__":
    print("\n[*] YOLO Inference API started!")
    print("[*] Running on http://localhost:5000")
    print("[*] Upload endpoint: POST http://localhost:5000/detect\n")
    app.run(host="0.0.0.0", port=5000, debug=False)
