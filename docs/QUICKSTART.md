# 🚀 Quick Start Guide

## ✅ What's Fixed

- ✓ Updated Python dependencies for Python 3.13 compatibility
- ✓ Both Flask API and Express servers now tested and working
- ✓ Created startup scripts for easy launch

## 🎯 First Time Setup (One Time Only)

### 1. Install Dependencies

```bash
cd scripts

# Install Node.js packages
npm install

# Install Python packages
pip install -r requirements.txt
```

## 🚀 Running the System

### Option A: Use the Startup Script (Easiest)

**Windows:**
```bash
cd scripts
start.bat
```

This opens two terminal windows automatically:
- Terminal 1: Flask API (port 5000)
- Terminal 2: Express Server (port 3000)

**Mac/Linux:**
```bash
cd scripts
python start.py
```

### Option B: Manual Start (Two Terminal Windows)

**Terminal 1 - Start Flask API:**
```bash
cd scripts
python inference_api.py
```

**Terminal 2 - Start Express Server:**
```bash
cd scripts
npm start
```

Wait for both to show "running" messages, then open browser.

## 🌐 Access Dashboard

Open your browser and go to:
```
http://localhost:3000
```

You should see the Aranya Dashboard with:
- 📸 Image upload area
- 🎯 Original image display
- 📊 Classified results
- ✅ Detection list

## 📤 Upload and Classify

1. **Drag-and-drop** an image onto the upload area, or
2. **Click** "Select Image" button to choose a file
3. Wait for classification (2-10 seconds)
4. View results:
   - Original image on left
   - Classified image with bounding boxes on right
   - Detection list below with class names and confidence

## 📁 Output Files

All results are saved to `output_evidence/`:
```
latest.jpg              # Last uploaded image
latest_annotated.jpg    # Classification with bounding boxes
latest.json             # Detection results (JSON)
```

## ✅ Verification

### Flask API Health Check
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-05-18T17:12:10.123Z"
}
```

### Express Server Health Check
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-05-18T17:12:10.648Z",
  "python_api": "checking..."
}
```

## 🛑 Stopping the System

- **Windows (start.bat)**: Close the terminal windows or press CTRL+C
- **Manual start**: Press CTRL+C in each terminal window

## ❓ Common Issues

### "Port already in use"
```bash
# Windows - Kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Windows - Kill process on port 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### "Module not found" errors
```bash
# Reinstall Python packages
pip install -r requirements.txt --upgrade --force-reinstall
```

### "Model not found"
Ensure `scripts/best.pt` exists and is your trained YOLO model.

## 📊 System Status

### Running Ports:
- **3000**: Express.js Server
- **5000**: Flask Inference API

### Key Files:
- `scripts/inference_api.py` - YOLO inference engine
- `scripts/server.js` - Express web server
- `scripts/dashboard.html` - Web interface
- `scripts/inference_utils.py` - YOLO inference utilities

## 🎓 API Usage Examples

### Upload via Browser
Simply use the dashboard at http://localhost:3000

### Upload via cURL
```bash
curl -X POST --data-binary "@image.jpg" http://localhost:3000/upload
```

### Upload via Python
```python
import requests

with open("image.jpg", "rb") as f:
    response = requests.post("http://localhost:3000/upload", data=f)
    print(response.json())
```

## 📚 Full Documentation

See `SETUP_GUIDE.md` for:
- Detailed architecture explanation
- All API endpoints
- Configuration options
- Troubleshooting guide
- Advanced usage

---

**Ready to go!** 🚀
