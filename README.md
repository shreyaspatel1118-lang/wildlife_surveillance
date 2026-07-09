# 🦁 Aranya Wildlife Detection System

A complete wildlife detection system using YOLO inference with MongoDB-backed image storage and professional web gallery interface.

---

## 📁 Project Structure

```
Aranya_KA_Detection/
│
├── src/                          # Source code directory
│   ├── server/                   # Node.js servers
│   │   ├── server.js            # Main Express server (port 3000)
│   │   ├── mongo_server.js       # Gallery backend server (port 3001)
│   │   ├── package.json          # Node dependencies
│   │   └── .env                  # Environment variables
│   │
│   ├── inference/                # Python YOLO inference
│   │   ├── inference_api.py      # Flask API (port 5000)
│   │   ├── inference_utils.py    # Detection utilities
│   │   └── requirements.txt      # Python dependencies
│   │
│   ├── web/                      # Web UI files
│   │   ├── dashboard.html        # Main dashboard
│   │   └── gallery-page.html     # Professional gallery interface
│   │
│   └── config/                   # Configuration files
│       └── .env.example          # Example environment file
│
├── models/                       # ML models
│   └── best.pt                  # YOLOv8 trained model
│
├── output/                       # System outputs (generated)
│   └── gallery/                 # Stored classified images
│
├── output_evidence/              # Detection results
│   └── gallery/                 # Local file fallback storage
│
├── startup_scripts/              # Launch scripts
│   ├── start_all.ps1            # PowerShell launcher (recommended)
│   ├── start_all.bat            # Batch file launcher
│   └── start.py                 # Python launcher
│
├── docs/                         # Documentation
│   ├── QUICKSTART.md
│   ├── SETUP_GUIDE.md
│   └── README_MONGO.md
│
└── .vscode/                      # VS Code settings
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- MongoDB Atlas account (or local fallback)

### Installation

1. **Install Node dependencies:**
```bash
cd src/server
npm install
```

2. **Install Python dependencies:**
```bash
cd src/inference
pip install -r requirements.txt
```

### Launch Services

**Option 1: Automated (Recommended)**
```bash
cd startup_scripts
.\start_all.ps1        # PowerShell
# or
start_all.bat          # Command Prompt
```

**Option 2: Manual Start (3 Terminals)**

Terminal 1 - Gallery Backend:
```bash
cd src/server
node mongo_server.js
```

Terminal 2 - Main Server:
```bash
cd src/server
node server.js
```

Terminal 3 - Python Inference:
```bash
cd src/inference
python inference_api.py
```

---

## 🌐 Access Points

| Service | URL | Port |
|---------|-----|------|
| Dashboard | http://localhost:3000 | 3000 |
| Professional Gallery | http://localhost:3000/gallery | 3000 |
| Image Upload | http://localhost:3000/upload | 3000 |
| Python Inference API | http://localhost:5000/detect | 5000 |
| Gallery Backend API | http://localhost:3001/gallery | 3001 |

---

## 🔧 Configuration

### Environment Variables

Create `.env` in `src/server/`:

```env
MONGO_URI=mongodb://user:pass@host:27017/database
PORT=3000
PYTHON_API_URL=http://localhost:5000
```

### MongoDB Setup

If using MongoDB Atlas:
1. Create cluster and user
2. Whitelist IP address
3. Get connection string
4. Add to `.env`

Local fallback uses: `output_evidence/gallery/`

---

## 📊 System Features

✅ **Real-time YOLO Detection**
- Confidence threshold: 0.30
- IOU threshold: 0.45

✅ **Dual Inference Mode**
- Primary: Roboflow API (requires credentials)
- Fallback: Local YOLOv8 model (best.pt)

✅ **Image Storage**
- Primary: MongoDB GridFS
- Fallback: Local file system with JSON index

✅ **Professional Gallery**
- Responsive masonry grid
- Search & filter functionality
- Lightbox modal viewing
- Auto-refresh every 10 seconds
- Real-time statistics

✅ **Multi-port Architecture**
- 3000: Main Express server
- 3001: Gallery backend
- 5000: Python inference

---

## 📝 Services Overview

### Main Server (Port 3000)
- Express.js application
- Image upload endpoint
- Dashboard/gallery UI
- API proxy to gallery backend
- Static file serving

### Gallery Server (Port 3001)
- MongoDB GridFS management
- Image serving endpoint
- Metadata storage
- Local file fallback on DB failure

### Inference API (Port 5000)
- Flask-based YOLO detection
- Image processing and classification
- Roboflow API with fallback
- Binary image input support

---

## 🗂️ File Organization

**Old Structure Removed:**
- ❌ `scripts/` - Consolidated to `src/`
- ❌ `Aranya_KA_Detection-1/` - Old dataset
- ❌ `Aranya_KA_V2_Data/` - Duplicate dataset
- ❌ `test_input/` - Test directory
- ❌ Root-level configs and scripts

**New Organization Benefits:**
- ✅ Clear separation of concerns
- ✅ Modular architecture
- ✅ Easy to maintain and extend
- ✅ Professional project layout
- ✅ Centralized startup scripts

---

## 📊 API Endpoints

### Main Server (3000)

```
GET  /                    - Serve dashboard.html
GET  /gallery             - Serve professional gallery
GET  /api/gallery         - Get all classified images (JSON)
POST /upload              - Upload image for detection
GET  /latest-results      - Get latest detection results
GET  /health              - Health check
```

### Gallery Server (3001)

```
GET  /gallery             - List all classified images
GET  /image/:id           - Serve image file
POST /upload              - Store classified image
POST /classify/:id        - Mark image as classified
```

### Inference API (5000)

```
GET  /health              - API health status
POST /detect              - Run YOLO detection on image
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill all Node processes
taskkill /F /IM node.exe

# Kill all Python processes
taskkill /F /IM python.exe
```

### MongoDB Connection Error
The system automatically falls back to local file storage in `output_evidence/gallery/`

### Missing Dependencies
```bash
cd src/server && npm install
cd src/inference && pip install -r requirements.txt
```

---

## 📦 Dependencies

### Node.js (src/server/)
- express
- mongodb
- multer
- dotenv
- form-data
- axios

### Python (src/inference/)
- flask
- flask-cors
- ultralytics (YOLO)
- opencv-python
- requests
- python-dotenv

---

## 🎯 Next Steps

1. Set up MongoDB Atlas or use local fallback
2. Configure `.env` file in `src/server/`
3. Run `npm install` in `src/server/`
4. Run `pip install -r requirements.txt` in `src/inference/`
5. Execute startup script: `startup_scripts/start_all.ps1`
6. Open http://localhost:3000/gallery

---

## 📄 License

Aranya Wildlife Detection System - 2026

---

## 📞 Support

For issues or questions, check documentation files in the `docs/` folder.
