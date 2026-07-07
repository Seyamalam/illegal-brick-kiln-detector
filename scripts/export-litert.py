from pathlib import Path

from ultralytics import YOLO


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "model" / "best.pt"


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing source checkpoint: {SOURCE}")

    model = YOLO(str(SOURCE))
    exported = Path(model.export(format="litert", imgsz=256, nms=False))
    target = ROOT / "model" / "best.tflite"
    if exported != target:
        target.write_bytes(exported.read_bytes())

    print(f"Exported LiteRT model: {target}")


if __name__ == "__main__":
    main()
