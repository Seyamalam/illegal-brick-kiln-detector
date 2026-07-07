from __future__ import annotations

import json
import math
import os
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image


SUPPORTED_REGIONS = {
    "brahmanbaria",
    "jessore",
    "manikganj",
    "tangail",
    "mymensingh",
}

CLASS_NAMES = ["CFCBK", "FCBK", "Zigzag"]
INPUT_SIZE = int(os.environ.get("KILN_MODEL_INPUT_SIZE", "256"))
DEFAULT_CONFIDENCE = float(os.environ.get("KILN_CONFIDENCE_THRESHOLD", "0.35"))
DEFAULT_IOU = float(os.environ.get("KILN_IOU_THRESHOLD", "0.45"))
MAX_TILES_PER_REGION = int(os.environ.get("KILN_MAX_TILES_PER_REGION", "25"))
MAX_DETECTIONS = int(os.environ.get("KILN_MAX_DETECTIONS", "100"))

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = Path(os.environ.get("KILN_MODEL_PATH", PROJECT_ROOT / "model" / "best.tflite"))
MANIFEST_PATH = Path(
    os.environ.get("KILN_TILE_MANIFEST_PATH", PROJECT_ROOT / "model" / "tiles.json")
)


@dataclass(frozen=True)
class Tile:
    tile_id: str
    url: str | None
    path: str | None
    center_lat: float
    center_lon: float
    lat_delta: float
    lon_delta: float


_INTERPRETER: Any | None = None
_INPUT_DETAILS: list[dict[str, Any]] | None = None
_OUTPUT_DETAILS: list[dict[str, Any]] | None = None
_MANIFEST_CACHE: dict[str, list[Tile]] | None = None


def _json_response(handler: BaseHTTPRequestHandler, status: int, body: dict[str, Any]) -> None:
    payload = json.dumps(body, separators=(",", ":")).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


def _load_interpreter() -> Any:
    global _INTERPRETER, _INPUT_DETAILS, _OUTPUT_DETAILS
    if _INTERPRETER is not None:
        return _INTERPRETER

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"LiteRT model not found: {MODEL_PATH}")

    from ai_edge_litert.interpreter import Interpreter

    interpreter = Interpreter(model_path=str(MODEL_PATH))
    interpreter.allocate_tensors()
    _INTERPRETER = interpreter
    _INPUT_DETAILS = interpreter.get_input_details()
    _OUTPUT_DETAILS = interpreter.get_output_details()
    return interpreter


def _load_manifest() -> dict[str, list[Tile]]:
    global _MANIFEST_CACHE
    if _MANIFEST_CACHE is not None:
        return _MANIFEST_CACHE

    manifest_url = os.environ.get("KILN_TILE_MANIFEST_URL")
    if manifest_url:
        with urllib.request.urlopen(manifest_url, timeout=10) as response:
            raw_manifest = json.loads(response.read().decode("utf-8"))
    elif MANIFEST_PATH.exists():
        raw_manifest = json.loads(MANIFEST_PATH.read_text())
    else:
        _MANIFEST_CACHE = {}
        return _MANIFEST_CACHE

    regions = raw_manifest.get("regions", raw_manifest)
    parsed: dict[str, list[Tile]] = {}
    for region, tiles in regions.items():
        if region not in SUPPORTED_REGIONS or not isinstance(tiles, list):
            continue

        parsed[region] = [_parse_tile(tile) for tile in tiles]

    _MANIFEST_CACHE = parsed
    return parsed


def _parse_tile(tile: dict[str, Any]) -> Tile:
    lat_delta = float(tile.get("latDelta", tile.get("lat_delta", 0.01)))
    lon_delta = float(tile.get("lonDelta", tile.get("lon_delta", 0.01)))

    return Tile(
        tile_id=str(tile.get("id") or tile.get("tileId") or tile.get("path") or tile.get("url")),
        url=str(tile["url"]) if tile.get("url") else None,
        path=str(tile["path"]) if tile.get("path") else None,
        center_lat=float(tile["centerLat"]),
        center_lon=float(tile["centerLon"]),
        lat_delta=lat_delta,
        lon_delta=lon_delta,
    )


def _open_tile_image(tile: Tile) -> Image.Image:
    if tile.url:
        with urllib.request.urlopen(tile.url, timeout=10) as response:
            return Image.open(response).convert("RGB")

    if not tile.path:
        raise ValueError(f"Tile has neither url nor path: {tile.tile_id}")

    path = Path(tile.path)
    if not path.is_absolute():
        path = PROJECT_ROOT / path

    return Image.open(path).convert("RGB")


def _prepare_image(image: Image.Image) -> np.ndarray:
    resized = image.resize((INPUT_SIZE, INPUT_SIZE))
    arr = np.asarray(resized, dtype=np.float32) / 255.0
    return np.expand_dims(arr.transpose(2, 0, 1), axis=0)


def _run_model(input_tensor: np.ndarray) -> np.ndarray:
    interpreter = _load_interpreter()
    if _INPUT_DETAILS is None or _OUTPUT_DETAILS is None:
        raise RuntimeError("LiteRT interpreter is not initialized")

    input_detail = _INPUT_DETAILS[0]
    if input_detail["dtype"] == np.uint8:
        scale, zero_point = input_detail["quantization"]
        input_tensor = (input_tensor / scale + zero_point).astype(np.uint8)
    else:
        input_tensor = input_tensor.astype(input_detail["dtype"])

    interpreter.set_tensor(input_detail["index"], input_tensor)
    interpreter.invoke()
    return interpreter.get_tensor(_OUTPUT_DETAILS[0]["index"])


def _decode_output(
    output: np.ndarray,
    tile: Tile,
    confidence_threshold: float,
    iou_threshold: float,
) -> list[dict[str, Any]]:
    raw = np.squeeze(output)
    if raw.ndim != 2:
        return []

    # Ultralytics YOLO OBB export is expected as (channels, anchors).
    if raw.shape[0] < raw.shape[1]:
        raw = raw.T

    detections: list[dict[str, Any]] = []
    for row in raw:
        if row.shape[0] < 5 + len(CLASS_NAMES):
            continue

        x_center, y_center, width, height = [float(v) for v in row[:4]]
        class_scores = row[4 : 4 + len(CLASS_NAMES)]
        class_index = int(np.argmax(class_scores))
        confidence = float(class_scores[class_index])
        angle = float(row[4 + len(CLASS_NAMES)]) if row.shape[0] > 4 + len(CLASS_NAMES) else 0.0

        if confidence < confidence_threshold:
            continue

        detections.append(
            {
                "x": x_center,
                "y": y_center,
                "w": width,
                "h": height,
                "angle": angle,
                "confidence": confidence,
                "classIndex": class_index,
            }
        )

    kept = _nms(detections, iou_threshold)[:MAX_DETECTIONS]
    return [_prediction_from_detection(tile, detection, index) for index, detection in enumerate(kept)]


def _nms(detections: list[dict[str, Any]], iou_threshold: float) -> list[dict[str, Any]]:
    kept: list[dict[str, Any]] = []
    ordered = sorted(detections, key=lambda item: item["confidence"], reverse=True)

    for candidate in ordered:
        if all(_box_iou(candidate, existing) < iou_threshold for existing in kept):
            kept.append(candidate)

    return kept


def _box_iou(a: dict[str, Any], b: dict[str, Any]) -> float:
    ax1, ay1, ax2, ay2 = _axis_box(a)
    bx1, by1, bx2, by2 = _axis_box(b)

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)
    inter_area = max(0.0, inter_x2 - inter_x1) * max(0.0, inter_y2 - inter_y1)
    a_area = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    b_area = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = a_area + b_area - inter_area
    return inter_area / union if union > 0 else 0.0


def _axis_box(detection: dict[str, Any]) -> tuple[float, float, float, float]:
    half_w = float(detection["w"]) / 2
    half_h = float(detection["h"]) / 2
    return (
        float(detection["x"]) - half_w,
        float(detection["y"]) - half_h,
        float(detection["x"]) + half_w,
        float(detection["y"]) + half_h,
    )


def _prediction_from_detection(
    tile: Tile, detection: dict[str, Any], detection_index: int
) -> dict[str, Any]:
    x = float(detection["x"])
    y = float(detection["y"])
    if 0.0 <= x <= 1.0 and 0.0 <= y <= 1.0:
        normalized_x = x
        normalized_y = y
    else:
        normalized_x = x / INPUT_SIZE
        normalized_y = y / INPUT_SIZE

    lat = tile.center_lat + (0.5 - normalized_y) * tile.lat_delta
    lon = tile.center_lon + (normalized_x - 0.5) * tile.lon_delta
    class_name = CLASS_NAMES[int(detection["classIndex"])]

    return {
        "id": f"{tile.tile_id}_{detection_index}_{class_name.lower()}",
        "lat": lat,
        "lon": lon,
        "confidence": max(0.0, min(1.0, float(detection["confidence"]))),
        "label": "kiln",
        "tileUrl": tile.url or tile.path or "",
    }


def predict_region(region: str, confidence: float, iou: float) -> dict[str, Any]:
    tiles = _load_manifest().get(region, [])[:MAX_TILES_PER_REGION]
    predictions: list[dict[str, Any]] = []

    if tiles:
        _load_interpreter()

    for tile in tiles:
        image = _open_tile_image(tile)
        output = _run_model(_prepare_image(image))
        predictions.extend(_decode_output(output, tile, confidence, iou))

    return {
        "region": region,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "predictions": predictions[:MAX_DETECTIONS],
    }


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        started_at = time.perf_counter()
        try:
            parsed = urllib.parse.urlparse(self.path)
            query = urllib.parse.parse_qs(parsed.query)
            region = query.get("region", [""])[0]
            confidence = float(query.get("confidence", [DEFAULT_CONFIDENCE])[0])
            iou = float(query.get("iou", [DEFAULT_IOU])[0])

            if region not in SUPPORTED_REGIONS:
                _json_response(
                    self,
                    400,
                    {
                        "error": "unsupported_region",
                        "supportedRegions": sorted(SUPPORTED_REGIONS),
                    },
                )
                return

            _json_response(self, 200, predict_region(region, confidence, iou))
        except Exception as exc:
            print(f"predict failed: {type(exc).__name__}: {exc}")
            _json_response(
                self,
                503,
                {
                    "error": "prediction_failed",
                    "message": str(exc),
                },
            )
        finally:
            elapsed_ms = math.floor((time.perf_counter() - started_at) * 1000)
            print(f"GET {self.path} completed in {elapsed_ms}ms")


if __name__ == "__main__":
    from http.server import HTTPServer

    port = int(os.environ.get("PORT", "8000"))
    server = HTTPServer(("127.0.0.1", port), handler)
    print(f"Serving prediction API at http://127.0.0.1:{port}/predict")
    server.serve_forever()
