# Illegal Brick Kiln Detector

Dashboard for AI-assisted illegal brick kiln detection in Bangladesh. The app uses:

- Next.js App Router for the UI
- Convex for region and app data
- A Vercel Python function with a LiteRT YOLO OBB model for prediction
- Bundled demo SentinelKilnDB tiles in `public/demo-tiles/`

## Prerequisites

- Bun
- A linked Convex project
- Python support for Vercel deployment is configured through `.python-version`

Install dependencies:

```bash
bun install
```

## Local Development

Start Convex dev. This should create or refresh `.env.local` with
`NEXT_PUBLIC_CONVEX_URL`.

```bash
bun run convex:watch
```

In another terminal, seed the five supported districts in the dev deployment:

```bash
bunx convex run regions:seedSupportedRegions
```

Start the local Python prediction API:

```bash
KILN_CONFIDENCE_THRESHOLD=0.01 PORT=8765 \
  python api/predict.py
```

If your system Python does not have the runtime dependencies installed, use the
same Python environment used for LiteRT export, or install:

```bash
python -m pip install -r requirements.txt
```

Start Next.js and proxy `/predict` to the local Python API:

```bash
PREDICT_API_BASE=http://127.0.0.1:8765 bun run dev
```

Open:

```txt
http://localhost:3000
```

Use the UI:

1. Select one of the five districts.
2. Click `Run seeded tiles`.
3. Click a detection row to inspect the satellite tile and OBB overlay.
4. Use `Upload image` to run transient prediction on a local image. Uploads are
   processed in memory and are not saved to Convex or disk.

## Seed Data

The dashboard needs five region records in Convex. The seed mutation is
idempotent, so it is safe to run more than once.

Seed dev:

```bash
bunx convex run regions:seedSupportedRegions
```

Seed prod after deploying Convex functions:

```bash
bunx convex deploy
bunx convex run regions:seedSupportedRegions --prod
```

If you want to push local Convex code and seed in one command, use:

```bash
bunx convex run regions:seedSupportedRegions --prod --push
```

## Production Deployment

Deploy Convex functions:

```bash
bunx convex deploy
```

When running locally, Convex may ask you to confirm deploying to production.
Answer `Y` after checking the production URL.

Seed production regions:

```bash
bunx convex run regions:seedSupportedRegions --prod
```

Deploy the Next/Vercel app with these environment variables:

```txt
NEXT_PUBLIC_CONVEX_URL=<your production Convex URL>
```

No `KILN_TILE_MANIFEST_URL` is required for the bundled demo. The Python
prediction API reads `model/tiles.json`, which points to preseeded images in
`public/demo-tiles/`.

## Useful Commands

```bash
bun run lint
NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build
bun run convex:gen
bunx convex deploy
```

Test the prediction API locally:

```bash
curl -sS "http://127.0.0.1:8765/predict?region=brahmanbaria&confidence=0.01"
```

Test through Next.js local proxy:

```bash
curl -sS "http://127.0.0.1:3000/predict?region=brahmanbaria&confidence=0.01"
```

## Model Notes

- `model/best.tflite` is the deployed LiteRT model.
- `model/tiles.json` lists bundled demo tile images for all five supported
  districts.
- `model/best.pt` and the training notebook are local training artifacts and are
  not required for the deployed demo path.
