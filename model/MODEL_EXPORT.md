# Model Export

The Vercel prediction API expects a LiteRT/TFLite artifact at:

```txt
model/best.tflite
```

Export from the PyTorch checkpoint in a Python 3.11 or 3.12 environment. Python 3.14 fails
inside `litert-torch`/`torchao`, so use `uv` to select Python 3.12:

```bash
uv venv --python 3.12 /tmp/kiln-litert-export-312
uv pip install --python /tmp/kiln-litert-export-312/bin/python ultralytics litert-torch ai-edge-litert
/tmp/kiln-litert-export-312/bin/python scripts/export-litert.py
```

Expected input/output shape from the current checkpoint:

```txt
input:  (1, 3, 256, 256)
output: (1, 8, 1344)
```

After export, keep `model/best.pt` for training provenance and deploy `model/best.tflite`
with the Vercel Python function.
