# Illegal Brick-Kiln Detector — Frontend + Backend Build Plan

## Project summary

A dashboard that displays AI-detected illegal brick kilns in Bangladesh on a map, built from
satellite tile imagery. This document covers **frontend + backend only**. A teammate owns the
ML model separately; you are building against a fixed API contract that a real model will
eventually fulfill — build against a mock version of it for now.

Districts with real data support: **Brahmanbaria, Jessore, Manikganj, Tangail, Mymensingh**.
Only these 5 regions should be selectable — no nationwide coverage.

## Tech stack

- **Frontend:** Next.js
- **Map library:** Leaflet
- **Backend/data layer:** Convex (schema, queries, mutations, actions, scheduled cron)
- **Mock ML API:** A real standalone Node/Next.js API route (not an inline frontend stub),
  returning data matching the contract below exactly, so swapping to the real API later
  requires no frontend or schema changes.

Deployment is out of scope for this build — do not include deployment steps.

## Feature list (build exactly this)

1. **Map view of a region** — populated with detected kiln locations as pins.
2. **Confidence-based visual distinction on pins** — e.g. red >0.8, yellow 0.5–0.8, muted/lower
   below that or for `no_kiln` labels.
3. **Click a detection → detail panel** — satellite tile image, coordinates, confidence score,
   feedback buttons/counts (see feature 6).
4. **Region/district switcher** — lists only the 5 seeded districts.
5. **Summary stats per region** — e.g. total predictions, high-confidence count. Compute this
   client-side from data already fetched for the map — do not add a separate query for it.
6. **Feedback: confirm / false positive** — open to anyone, no auth, no login, no vote
   deduplication. Simple increment buttons on each detection. Counts live directly on the
   prediction record (not a separate table), so the detail panel can show e.g. "12 people
   confirmed this." Apply updates optimistically on the frontend.
7. **"Copy as list" export** — button that formats the currently viewed region's predictions
   into a plain text/markdown list and copies it to the clipboard. Pure client-side
   transformation of data already in frontend state — no backend endpoint, no PDF generation.
8. **"Last updated" timestamp per region** — set after each ingestion run completes.

## API contract: `/predict` (mock now, real later — shape must not change)

```
GET /predict?region={region_slug}
```

Response:

```json
{
  "region": "brahmanbaria",
  "generatedAt": "2026-07-07T10:00:00Z",
  "predictions": [
    {
      "id": "pred_001",
      "lat": 23.9571,
      "lon": 91.1119,
      "confidence": 0.91,
      "label": "kiln",
      "tileUrl": "https://.../tile_001.png"
    }
  ]
}
```

- `label` is `"kiln"` or `"no_kiln"`.
- `confidence` is a float 0–1.
- `tileUrl` points to an image of the satellite crop.
- `confirmCount` / `falsePositiveCount` are NOT part of this response — they are Convex-side
  state, starting at 0 on first insert, never touched by ingestion updates.

### Mock `/predict` service requirements

- Standalone API route, not embedded in frontend code.
- Deterministic, seeded data — hardcoded array or fixed seed. Do not use `Math.random()` per
  request; same call must return the same data every time.
- Seed 15–25 fake predictions per region, geographically clustered around each district's real
  center coordinates (not scattered randomly).
- Mix confidence values: some >0.8, some 0.4–0.7, at least one or two `no_kiln` entries per
  region.
- Add artificial latency of 200–500ms to every response.

## Convex schema

```ts
// convex/schema.ts
export default defineSchema({
  regions: defineTable({
    slug: v.string(),        // "brahmanbaria" — public identifier used in routes and the
                              // /predict API's ?region= param
    name: v.string(),        // "Brahmanbaria"
    centerLat: v.number(),
    centerLon: v.number(),
    defaultZoom: v.number(),
    lastUpdated: v.number(), // epoch ms, set after each ingestion run
  }).index("by_slug", ["slug"]),

  predictions: defineTable({
    externalId: v.string(),      // ML service's own id (e.g. "pred_001"), used to detect
                                  // existing rows for upsert
    regionId: v.id("regions"),
    lat: v.number(),
    lon: v.number(),
    confidence: v.number(),
    label: v.union(v.literal("kiln"), v.literal("no_kiln")),
    tileUrl: v.string(),
    confirmCount: v.number(),
    falsePositiveCount: v.number(),
  })
    .index("by_region", ["regionId"])
    .index("by_external_id", ["externalId"]),
});
```

Region rows (the 5 districts) will be seeded separately — not part of this build task, but the
schema must support it as-is.

## Ingestion

This is the only piece that changes when the real ML API replaces the mock — keep it isolated.

```ts
// convex/ingest.ts
export const ingestRegion = action({
  args: { regionSlug: v.string() },
  handler: async (ctx, { regionSlug }) => {
    const region = await ctx.runQuery(internal.regions.getBySlug, { slug: regionSlug });
    if (!region) throw new Error(`Unknown region slug: ${regionSlug}`);

    const res = await fetch(`${process.env.PREDICT_API_BASE}/predict?region=${regionSlug}`);
    const data = await res.json();

    for (const pred of data.predictions) {
      await ctx.runMutation(internal.predictions.upsert, {
        externalId: pred.id,
        regionId: region._id,
        lat: pred.lat,
        lon: pred.lon,
        confidence: pred.confidence,
        label: pred.label,
        tileUrl: pred.tileUrl,
      });
    }

    await ctx.runMutation(internal.regions.touchLastUpdated, {
      regionId: region._id,
      timestamp: Date.now(),
    });
  },
});
```

```ts
// convex/regions.ts
export const getBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) =>
    ctx.db.query("regions").withIndex("by_slug", q => q.eq("slug", slug)).unique(),
});

export const touchLastUpdated = internalMutation({
  args: { regionId: v.id("regions"), timestamp: v.number() },
  handler: async (ctx, { regionId, timestamp }) => {
    await ctx.db.patch(regionId, { lastUpdated: timestamp });
  },
});
```

### Upsert (not wipe-and-replace, to preserve feedback counts)

```ts
// convex/predictions.ts
export const upsert = internalMutation({
  args: {
    externalId: v.string(),
    regionId: v.id("regions"),
    lat: v.number(),
    lon: v.number(),
    confidence: v.number(),
    label: v.union(v.literal("kiln"), v.literal("no_kiln")),
    tileUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("predictions")
      .withIndex("by_external_id", q => q.eq("externalId", args.externalId))
      .unique();

    if (existing) {
      // Update model-output fields only — do not touch confirmCount/falsePositiveCount.
      await ctx.db.patch(existing._id, {
        regionId: args.regionId,
        lat: args.lat,
        lon: args.lon,
        confidence: args.confidence,
        label: args.label,
        tileUrl: args.tileUrl,
      });
    } else {
      await ctx.db.insert("predictions", {
        ...args,
        confirmCount: 0,
        falsePositiveCount: 0,
      });
    }
  },
});
```

### Ingestion error handling

If the `fetch` call to `/predict` fails inside `ingestRegion`: throw, catch, log. No retry loop.

## Feedback mutations (public, no auth)

```ts
// convex/predictions.ts
export const confirmPrediction = mutation({
  args: { id: v.id("predictions") },
  handler: async (ctx, { id }) => {
    const pred = await ctx.db.get(id);
    if (!pred) throw new Error("Not found");
    await ctx.db.patch(id, { confirmCount: pred.confirmCount + 1 });
  },
});

export const flagFalsePositive = mutation({
  args: { id: v.id("predictions") },
  handler: async (ctx, { id }) => {
    const pred = await ctx.db.get(id);
    if (!pred) throw new Error("Not found");
    await ctx.db.patch(id, { falsePositiveCount: pred.falsePositiveCount + 1 });
  },
});
```

No confirmation modal — these should feel like casual thumbs-up/down taps, applied
optimistically on the frontend.

## Queries needed for the frontend

- `getRegions()` — powers the region switcher.
- `getPredictionsForRegion(regionId)` — powers the map, the detail panel, and the
  client-computed summary stats. This is the single source of truth for most of the UI.

## Cron

Use a Convex scheduled cron (`crons.ts`) to call `ingestRegion` periodically for each seeded
region, on a wide interval (e.g. every few hours) — data freshness is not critical here.

## Frontend build order

1. Region switcher — static list from `getRegions()`.
2. Map component (Leaflet) — plain pins from `getPredictionsForRegion`.
3. Confidence-based pin styling.
4. Click → detail panel: tile image (placeholder fallback if `tileUrl` is broken/missing —
   placeholder asset will be provided separately), coordinates, confidence, feedback buttons +
   live counts.
5. Summary stats bar — computed client-side from the same query, no new backend query.
6. "Copy as list" export button — client-side formatting + clipboard copy.
7. Loading and empty states — mock API's artificial latency exists to exercise loading states.
   A region with zero predictions should just render the map with no pins.

## Error / edge cases to handle

- Region with zero predictions → map renders normally, no pins, no special UI.
- `/predict` fetch failure during ingestion → throw, catch, log, no retry.
- Broken/missing `tileUrl` → fall back to a placeholder image.

## Environment variables

- `PREDICT_API_BASE` — mock service URL now, will point to the real ML API later. This is the
  only value that changes when swapping mock → real.
- Standard Convex project env vars (deployment URL/keys).