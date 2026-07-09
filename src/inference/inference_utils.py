from __future__ import annotations

import os
import json
from dataclasses import dataclass
from typing import Any
from functools import lru_cache

import cv2
import numpy as np
import requests
from io import BytesIO
from pathlib import Path


_SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = Path(__file__).resolve().parents[2]
_MODEL_PATH_ENV = "ARANYA_MODEL_PATH"
_HUMAN_MODEL_PATH_ENV = "ARANYA_HUMAN_MODEL_PATH"

# Roboflow API Configuration (fallback)
ROBOFLOW_API_URL = "https://detect.roboflow.com/animal-detection-68jio/1"
ROBOFLOW_API_KEY = "rf_mS0uZOcHxkVYoaOMBifgbdJwFTt2"


@dataclass
class DetectionResult:
    names: list[str]
    annotations: np.ndarray | None
    detections: list[dict[str, Any]]
    error: str | None = None
    human_detected: bool = False
    detection_mode: str = "wildlife"


@lru_cache(maxsize=1)
def _get_human_model():
    from ultralytics import YOLO

    model_path = os.getenv(_HUMAN_MODEL_PATH_ENV, "yolov8n.pt")
    return YOLO(model_path)


def _run_human_gate(image: np.ndarray, conf: float = 0.40, iou: float = 0.45, imgsz: int = 640) -> DetectionResult | None:
    """Run a person-only pass first. If a human is found, return early and skip wildlife detection."""
    try:
        model = _get_human_model()
        results = model.predict(source=image, imgsz=imgsz, conf=conf, iou=iou, classes=[0], verbose=False)
        r = results[0]
        boxes = getattr(r, 'boxes', None)
        if boxes is None or len(boxes) == 0:
            return None

        xyxy = boxes.xyxy.cpu().numpy() if hasattr(boxes.xyxy, 'cpu') else boxes.xyxy
        confs = boxes.conf.cpu().numpy() if hasattr(boxes.conf, 'cpu') else boxes.conf

        detections: list[dict[str, Any]] = []
        annotated = image.copy()
        for i in range(len(xyxy)):
            x1, y1, x2, y2 = xyxy[i]
            c = float(confs[i])
            bbox_w = int(x2 - x1)
            bbox_h = int(y2 - y1)
            cx = int(x1 + bbox_w / 2)
            cy = int(y1 + bbox_h / 2)
            detections.append({
                'class_id': 0,
                'class_name': 'Human',
                'confidence': c,
                'x': cx,
                'y': cy,
                'width': bbox_w,
                'height': bbox_h
            })
            cv2.rectangle(annotated, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 2)
            cv2.putText(
                annotated,
                f"Human {c:.2f}",
                (int(x1), max(20, int(y1) - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 0, 255),
                2,
            )

        return DetectionResult(
            names=['Human'],
            annotations=annotated,
            detections=detections,
            human_detected=True,
            detection_mode="human"
        )
    except Exception as e:
        print(f"Human gate inference failed: {e}")
        return None


def decode_image_bytes(image_bytes: bytes) -> np.ndarray:
    """Decode raw image bytes to numpy array."""
    encoded_img = np.frombuffer(image_bytes, dtype=np.uint8)
    opencv_image = cv2.imdecode(encoded_img, cv2.IMREAD_COLOR)
    if opencv_image is None:
        raise ValueError("Unable to decode image bytes as a valid JPEG or PNG frame")
    return opencv_image


def draw_detections_on_image(image: np.ndarray, predictions: list[dict], conf_threshold: float = 0.30) -> np.ndarray:
    """Draw bounding boxes and labels on image based on predictions."""
    annotated = image.copy()

    # Filter by confidence threshold
    filtered_predictions = [p for p in predictions if p.get('confidence', 0) >= conf_threshold]

    for pred in filtered_predictions:
        x = int(pred.get('x', 0))
        y = int(pred.get('y', 0))
        width = int(pred.get('width', 0))
        height = int(pred.get('height', 0))
        confidence = float(pred.get('confidence', 0))
        class_name = pred.get('class', 'object')

        # Calculate bounding box coordinates (x,y represent center)
        x1 = max(0, x - width // 2)
        y1 = max(0, y - height // 2)
        x2 = min(annotated.shape[1], x + width // 2)
        y2 = min(annotated.shape[0], y + height // 2)

        color = (0, 255, 0)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        label = f"{class_name} {confidence:.2f}"
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.5
        thickness = 1
        text_size = cv2.getTextSize(label, font, font_scale, thickness)[0]
        label_y = max(y1 - 5, text_size[1] + 5)
        cv2.rectangle(annotated, (x1, label_y - text_size[1] - 5), (x1 + text_size[0], label_y + 5), color, -1)
        cv2.putText(annotated, label, (x1, label_y), font, font_scale, (0, 0, 0), thickness)

    return annotated


def _resolve_local_model_path() -> Path | None:
    env_value = os.getenv(_MODEL_PATH_ENV)
    candidates: list[Path] = []

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
        _REPO_ROOT / "models" / "best.pt",
        _REPO_ROOT / "best.pt",
        _REPO_ROOT / "best" / "weights" / "best.pt",
        _REPO_ROOT / "best" / "best.pt",
    ])

    for candidate in candidates:
        if candidate.is_file():
            return candidate

    return None


def run_detection(image: np.ndarray, conf: float = 0.30, iou: float = 0.45, imgsz: int = 640) -> DetectionResult:
    """Run human-first detection. If human found, skip wildlife. Otherwise run wildlife model then Roboflow fallback."""
    human_result = _run_human_gate(image, conf=0.40, iou=iou, imgsz=imgsz)
    if human_result is not None:
        return human_result

    local_model_path = _resolve_local_model_path()

    if local_model_path is not None:
        try:
            from ultralytics import YOLO

            model = YOLO(str(local_model_path))
            results = model.predict(source=image, imgsz=imgsz, conf=conf, verbose=False)
            r = results[0]
            boxes = getattr(r, 'boxes', None)
            detections = []
            class_names_set = set()

            if boxes is not None and len(boxes) > 0:
                xyxy = boxes.xyxy.cpu().numpy() if hasattr(boxes.xyxy, 'cpu') else boxes.xyxy
                confs = boxes.conf.cpu().numpy() if hasattr(boxes.conf, 'cpu') else boxes.conf
                cls = boxes.cls.cpu().numpy() if hasattr(boxes.cls, 'cpu') else boxes.cls
                names = model.names if hasattr(model, 'names') else {}

                for i in range(len(xyxy)):
                    x1, y1, x2, y2 = xyxy[i]
                    c = float(confs[i])
                    cid = int(cls[i])
                    cname = names.get(cid, str(cid))
                    class_names_set.add(cname)
                    bbox_w = int(x2 - x1)
                    bbox_h = int(y2 - y1)
                    cx = int(x1 + bbox_w / 2)
                    cy = int(y1 + bbox_h / 2)
                    detections.append({
                        'class_id': cid,
                        'class_name': cname,
                        'confidence': c,
                        'x': cx,
                        'y': cy,
                        'width': bbox_w,
                        'height': bbox_h
                    })

                annotated = r.plot() if hasattr(r, 'plot') else draw_detections_on_image(image, [], conf_threshold=conf)
                return DetectionResult(
                    names=list(class_names_set),
                    annotations=annotated,
                    detections=detections,
                    human_detected=False,
                    detection_mode="wildlife"
                )

            return DetectionResult(names=[], annotations=image, detections=[], human_detected=False, detection_mode="wildlife")
        except Exception as e:
            print(f"Local model inference failed at {local_model_path}: {e}")

    try:
        success, image_bytes = cv2.imencode('.jpg', image)
        if not success:
            return DetectionResult(names=[], annotations=None, detections=[], error="Failed to encode image")

        files = {'imageToUpload': ('image.jpg', BytesIO(image_bytes.tobytes()), 'image/jpeg')}
        params = {'api_key': ROBOFLOW_API_KEY, 'confidence': conf}
        try:
            response = requests.post(ROBOFLOW_API_URL, files=files, params=params, timeout=30)
            response.raise_for_status()
            roboflow_result = response.json()
            predictions = roboflow_result.get('predictions', [])
            predictions = [p for p in predictions if p.get('confidence', 0) >= conf]

            detections = []
            class_names_set = set()
            for pred in predictions:
                class_name = pred.get('class', 'unknown')
                class_names_set.add(class_name)
                detections.append({
                    'class_id': pred.get('class_id', 0),
                    'class_name': class_name,
                    'confidence': float(pred.get('confidence', 0)),
                    'x': pred.get('x', 0),
                    'y': pred.get('y', 0),
                    'width': pred.get('width', 0),
                    'height': pred.get('height', 0)
                })

            annotated = draw_detections_on_image(image, predictions, conf_threshold=conf)
            return DetectionResult(
                names=list(class_names_set) if class_names_set else ['animal'],
                annotations=annotated,
                detections=detections,
                human_detected=False,
                detection_mode="wildlife_fallback"
            )
        except requests.exceptions.RequestException as e:
            print(f"Roboflow API failed: {e}")
    except Exception as e:
        print(f"Error preparing Roboflow request: {e}")

    return DetectionResult(
        names=[],
        annotations=None,
        detections=[],
        error="No inference available (local model and Roboflow both failed)",
        human_detected=False,
        detection_mode="wildlife"
    )