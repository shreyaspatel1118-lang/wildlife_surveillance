# Aranya Wildlife Detection System

Complete integration of YOLO v8 image classification with web interface for real-time wildlife detection.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Web Browser (Dashboard)                │
│          http://localhost:3000                          │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────────┐
│              Express.js Server (Node.js)                │
│          http://localhost:3000                          │
│  • Receives image uploads                               │
│  • Routes to Python inference API                       │
│  • Serves classified results                            │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────────┐
│          Flask Inference API (Python)                   │
│          http://localhost:5000                          │
│  • YOLO v8 model inference                              │
│  • Image annotation with bounding boxes                 │
│  • Detection results (JSON)                             │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              YOLO v8 Model (best.pt)                    │
│  Located in: scripts/best.pt                            │
└─────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

- **Node.js** v14+ (download from https://nodejs.org/)
- **Python** 3.8+ (download from https://www.python.org/)
- **YOLO Model Weights** (`scripts/best.pt`) - must be present

## 🚀 Setup Instructions

### 1. Install Node.js Dependencies

```bash
cd scripts
npm install
```

This installs:
- `express` - Web server framework
- `axios` - HTTP client for calling Python API

### 2. Install Python Dependencies

```bash
# Option A: Using pip
pip install -r requirements.txt

# Option B: Using conda (if you have Anaconda)
conda create -n aranya python=3.10
conda activate aranya
pip install -r requirements.txt
```

Required packages:
- `flask` - Python web framework
- `flask-cors` - Enable cross-origin requests
- `ultralytics` - YOLO model library
- `opencv-python` - Image processing
- `numpy` - Numerical computing

### 3. Verify YOLO Model

Ensure `scripts/best.pt` exists in the project folder. This is your trained model.

```bash
# Check if model file exists
ls -la scripts/best.pt  # On Linux/Mac
dir scripts\best.pt     # On Windows
```

## 🔧 Running the System

The system requires **two separate processes**. Open two terminal windows:

### Terminal 1: Start Python Flask Inference API

```bash
cd scripts
python inference_api.py
```

Expected output:
```
🚀 YOLO Inference API started!
📡 Running on http://localhost:5000
📤 Upload endpoint: POST http://localhost:5000/detect
```

### Terminal 2: Start Express.js Web Server

```bash
cd scripts
npm start
```

Expected output:
```
🚀 Aranya Surveillance Server started!
📡 Dashboard: http://localhost:3000
📥 Upload Endpoint: http://localhost:3000/upload
⚙️  Python API: http://localhost:5000
📊 Results: http://localhost:3000/latest-results
```

## 🌐 Access the Dashboard

Open your browser and go to:

```
http://localhost:3000
```

You should see the Aranya Wildlife Detection dashboard with:
- Upload area for images
- Original image display
- Classified/annotated image display
- Detection results with confidence scores
- Status indicators

## 📤 How to Use

1. **Upload an Image**
   - Click "Select Image" or drag-and-drop an image
   - Supported formats: JPG, PNG
   - Max size: 50MB

2. **Image Classification**
   - The image is sent to the Python API
   - YOLO model runs inference (takes 2-10 seconds depending on hardware)
   - Results are displayed in real-time

3. **View Results**
   - Original image shown on the left
   - Classified image with bounding boxes on the right
   - Detection results list below with:
     - Object class name
     - Confidence percentage

## 📁 Output Files

All results are saved in `output_evidence/`:

```
output_evidence/
├── latest.jpg                 # Last uploaded original image
├── latest_annotated.jpg       # Last classified image with boxes
└── latest.json                # Detection results JSON
```

### Example JSON Result:
```json
{
  "timestamp": "2024-05-18T10:30:45.123456",
  "detections": [
    {
      "class_id": 0,
      "class_name": "elephant",
      "confidence": 0.92
    },
    {
      "class_id": 1,
      "class_name": "bird",
      "confidence": 0.87
    }
  ],
  "detection_count": 2,
  "class_names": ["elephant", "bird", "tree", "ground"]
}
```

## 🔗 API Endpoints

### Express.js Server (http://localhost:3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Dashboard HTML page |
| GET | `/health` | Health check |
| POST | `/upload` | Upload raw image bytes |
| GET | `/latest-results` | Get latest detection JSON |
| GET | `/uploads/*` | Serve output images |

### Python Inference API (http://localhost:5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/detect` | Run YOLO inference on image bytes |
| GET | `/latest-json` | Get latest detection results |
| GET | `/latest-annotated` | Get latest annotated JPEG image |

## 🐛 Troubleshooting

### Port Already in Use

If port 3000 or 5000 is already in use:

**For Express (Node.js):**
```bash
# Find process using port 3000
netstat -ano | findstr :3000  # Windows
lsof -i :3000                  # Mac/Linux

# Kill process (Windows)
taskkill /PID <PID> /F

# Or change port in server.js (modify PORT variable)
```

**For Flask (Python):**
```bash
# Change port in inference_api.py
# app.run(host="0.0.0.0", port=5001)  # Change 5000 to 5001
```

### YOLO Model Not Found

```
Error: FileNotFoundError: Model weights not found at scripts/best.pt
```

**Solution:** Ensure your trained YOLO model is in `scripts/best.pt`. If it's named differently, update:
- [inference_utils.py](inference_utils.py#L14) - `MODEL_PATH` variable

### Connection Refused

```
Error: Could not connect to Python API at http://localhost:5000
```

**Solution:** Make sure the Flask API is running in Terminal 1 before starting Express in Terminal 2.

### ESP32 Upload Returns `-1`

If the ESP32 prints `Upload Failed: -1`, the sketch did not get an HTTP response. That usually means the board could not reach the PC at all.

**Check these first:**
- Replace `serverName` with your PC's current LAN IP, not `localhost`.
- Make sure the ESP32 and PC are on the same Wi-Fi network.
- Allow inbound traffic on port `3000` in Windows Firewall.
- Use the upload URL printed by `src/server/server.js` when it starts.

**Add this diagnostic line to the ESP32 sketch:**

```cpp
Serial.printf("Upload failed: %s\n", http.errorToString(httpResponseCode).c_str());
```

That will tell you whether the issue is connection refused, timeout, or send failure instead of a generic `-1`.

### Module Not Found Errors

```
ModuleNotFoundError: No module named 'flask'
```

**Solution:** Make sure Python dependencies are installed:
```bash
pip install -r scripts/requirements.txt --upgrade
```

## 🎯 Configuration

### YOLO Inference Parameters

Modify these in `inference_api.py` line 42:

```python
result = run_detection(image, conf=0.30, iou=0.45, imgsz=640)
```

- **conf**: Confidence threshold (0.0-1.0). Lower = more detections
- **iou**: IoU threshold for NMS (0.0-1.0). Lower = fewer duplicates
- **imgsz**: Input image size (640, 320, etc.). Larger = slower but more accurate

### Change Dashboard Port

Edit `server.js` line 8:
```javascript
const PORT = 3000;  // Change to desired port
```

## 📊 System Requirements

### Minimum
- CPU: 2+ cores
- RAM: 4GB
- Disk: 2GB (for model + images)
- Inference time: 5-10 seconds per image

### Recommended
- GPU: NVIDIA CUDA (optional, speeds up inference 5-10x)
- RAM: 8GB+
- Inference time: 0.5-2 seconds per image

## 🔐 Security Notes

This system is designed for local use. For production:
- Add authentication
- Implement rate limiting
- Validate all inputs
- Use HTTPS
- Run behind a proxy (nginx/Apache)

## 📝 Logging

Both servers log activity to console:

**Express Logs:**
```
[10:30:45 AM] 📸 Image received (245120 bytes)
[10:30:46 AM] 🔍 Running YOLO inference...
[10:30:48 AM] ✅ Detection complete: 3 objects found
```

**Flask Logs:**
```
[10:30:46] INFO: Receiving image for inference
[10:30:48] INFO: Detection complete (0.2 ms)
```

## 🤝 API Integration Examples

### Upload Image via cURL

```bash
curl -X POST --data-binary "@image.jpg" http://localhost:3000/upload
```

### Upload via Python

```python
import requests

with open("image.jpg", "rb") as img:
    response = requests.post("http://localhost:3000/upload", data=img)
    results = response.json()
    print(f"Detected: {results['detection_count']} objects")
```

### Upload via JavaScript/Fetch

```javascript
const fileInput = document.getElementById("fileInput");
const formData = new FormData();
formData.append("image", fileInput.files[0]);

fetch("http://localhost:3000/upload", {
    method: "POST",
    body: await fileInput.files[0].arrayBuffer(),
    headers: { "Content-Type": "application/octet-stream" }
})
.then(r => r.json())
.then(data => console.log(data));
```

## 📚 Additional Resources

- [YOLO Documentation](https://docs.ultralytics.com/)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Express.js Documentation](https://expressjs.com/)
- [OpenCV Documentation](https://docs.opencv.org/)

## 📄 License

This project is provided as-is for wildlife detection research and monitoring.

---

**Version:** 1.0.0  
**Last Updated:** May 2024
