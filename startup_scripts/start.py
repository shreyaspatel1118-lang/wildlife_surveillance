#!/usr/bin/env python3
"""
Aranya Wildlife Detection - Simple starter script
Starts both Flask API and Express server with proper logging
"""

import subprocess
import time
import sys
import os
from pathlib import Path


def resolve_model_path():
    """Find the YOLO weights file used for local detection."""
    root_dir = Path(__file__).resolve().parents[1]
    env_value = os.getenv("ARANYA_MODEL_PATH")
    candidates = []

    if env_value:
        configured_path = Path(env_value).expanduser()
        if configured_path.is_file():
            return configured_path
        if configured_path.is_dir():
            candidates.extend([
                configured_path / "weights" / "best.pt",
                configured_path / "best.pt",
                configured_path / "model.pt",
            ])

    candidates.extend([
        root_dir / "models" / "best.pt",
        root_dir / "best.pt",
        root_dir / "best" / "weights" / "best.pt",
        root_dir / "best" / "best.pt",
    ])

    for candidate in candidates:
        if candidate.is_file():
            return candidate

    return None

def check_python():
    """Verify Python is available"""
    try:
        result = subprocess.run([sys.executable, "--version"], capture_output=True, text=True)
        print(f"✓ Python: {result.stdout.strip()}")
        return True
    except Exception as e:
        print(f"✗ Python not found: {e}")
        return False

def check_nodejs():
    """Verify Node.js is available"""
    try:
        result = subprocess.run(["node", "--version"], capture_output=True, text=True)
        print(f"✓ Node.js: {result.stdout.strip()}")
        return True
    except Exception as e:
        print(f"✗ Node.js not found: {e}")
        return False

def check_model():
    """Verify YOLO model exists"""
    model_path = resolve_model_path()
    if model_path is not None:
        size_mb = model_path.stat().st_size / (1024 * 1024)
        print(f"✓ YOLO Model: {model_path} ({size_mb:.1f} MB)")
        return True
    else:
        print("✗ YOLO Model not found. Set ARANYA_MODEL_PATH or place best.pt in models/.")
        return False

def start_servers():
    """Start both Flask and Express servers"""
    scripts_dir = Path(__file__).parent
    os.chdir(scripts_dir)
    
    print("\n" + "="*50)
    print("Starting Aranya Wildlife Detection System...")
    print("="*50 + "\n")
    
    # Start Flask API
    print("🚀 Starting Flask API on port 5000...")
    flask_process = subprocess.Popen(
        [sys.executable, "inference_api.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    time.sleep(3)
    
    # Start Express Server
    print("🚀 Starting Express Server on port 3000...")
    express_process = subprocess.Popen(
        ["npm", "start"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    time.sleep(2)
    
    print("\n" + "="*50)
    print("✓ Systems Started Successfully!")
    print("="*50)
    print("\n📡 Dashboard:       http://localhost:3000")
    print("📤 Upload:          http://localhost:3000/upload")
    print("🔍 Inference API:   http://localhost:5000")
    print("\nPress CTRL+C to stop all services...\n")
    
    try:
        # Keep servers running
        flask_process.wait()
        express_process.wait()
    except KeyboardInterrupt:
        print("\n\nShutting down...")
        flask_process.terminate()
        express_process.terminate()
        try:
            flask_process.wait(timeout=3)
            express_process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            flask_process.kill()
            express_process.kill()
        print("✓ Services stopped")
        sys.exit(0)

if __name__ == "__main__":
    print("\n" + "="*50)
    print("ARANYA WILDLIFE DETECTION SYSTEM")
    print("="*50 + "\n")
    
    # Check dependencies
    print("Checking dependencies...\n")
    
    if not check_python():
        print("\n✗ Please install Python: https://www.python.org/")
        sys.exit(1)
    
    if not check_nodejs():
        print("\n✗ Please install Node.js: https://nodejs.org/")
        sys.exit(1)
    
    if not check_model():
        print("\n✗ Please ensure models/best.pt exists or set ARANYA_MODEL_PATH")
        sys.exit(1)
    
    # Start servers
    start_servers()
