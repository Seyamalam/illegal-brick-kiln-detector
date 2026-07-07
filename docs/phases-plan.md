# Full-Stack Next.js + Convex Development Plan

## Summary

Build the dashboard in phases so every phase after schema setup has a manually testable UI slice. The implementation will keep the ML boundary isolated behind the exact `/predict?region={region_slug}` contract, store durable app state in Convex, and use the frontend only for presentation, client-side summary stats, optimistic feedback, and copy export.

Important repo facts:
- Current app is a minimal Next.js App Router app.
- Convex is installed, but no app-specific schema/functions exist yet.
- shadcn is configured with `radix-nova`, Tailwind v4, and `remixicon`.
- Region seeding is explicitly owned separately, so this plan assumes the five `regions` rows are seeded before UI phases are tested.
- Deployment is out of scope.

## Phase 0: Foundation And Schema

Purpose: establish typed Convex data shape and generated APIs. This phase is not UI-testable by design.

Backend:
- Add `convex/schema.ts`.
- Define `regions` table:
  - `slug`
  - `name`
  - `centerLat`
  - `centerLon`
  - `defaultZoom`
  - `lastUpdated`
  - index: `by_slug`
- Define `predictions` table:
  - `externalId`
  - `regionId`
  - `lat`
  - `lon`
  - `confidence`
  - `label`
  - `tileUrl`
  - `confirmCount`
  - `falsePositiveCount`
  - indexes: `by_region`, `by_external_id`
- Use Convex validators exactly, with `label` as `v.union(v.literal("kiln"), v.literal("no_kiln"))`.
- Keep feedback counts on `predictions`, not a separate table.

Frontend:
- No UI work in this phase.

Dependencies:
- Add `leaflet`, `react-leaflet`, and `@types/leaflet`.
- Add shadcn components needed by later phases using `bun run shadd`, likely:
  - `card`
  - `select`
  - `badge`
  - `sheet`
  - `skeleton`
  - `separator`
  - `sonner`
  - `tooltip`
  - `scroll-area`

Validation:
- Run `bun run lint`.
- Run Convex code generation via the normal Convex dev workflow so generated API/data model types exist.

## Phase 1: Convex Provider, Regions Query, And Region Switcher

Purpose: make the app connected to Convex and manually test that seeded regions appear in the UI.

Backend:
- Add `convex/regions.ts`.
- Add public query `getRegions`.
  - Args: none.
  - Returns all regions sorted by display name or by fixed seeded insertion order if ordering is not available.
  - Include `_id`, `slug`, `name`, `centerLat`, `centerLon`, `defaultZoom`, `lastUpdated`.
- Add internal query `getBySlug`.
  - Args: `{ slug: v.string() }`.
  - Uses `by_slug`.
  - Returns one region or `null`.
- Add internal mutation `touchLastUpdated`.
  - Args: `{ regionId: v.id("regions"), timestamp: v.number() }`.
  - Patches only `lastUpdated`.

Frontend:
- Add `components/ConvexClientProvider.tsx`.
  - `"use client"`.
  - Creates `ConvexReactClient` from `NEXT_PUBLIC_CONVEX_URL`.
  - Wraps app children in `ConvexProvider`.
- Update `app/layout.tsx` to wrap children with the provider.
- Replace `app/page.tsx` with a server shell that renders a client dashboard component.
- Add `components/KilnDashboard/index.tsx`.
  - `"use client"`.
  - Uses `useQuery(api.regions.getRegions)`.
  - Shows a shadcn `Select` listing only the five seeded districts.
  - Shows loading skeleton while regions load.
  - Shows an empty state if no regions exist.
  - Stores selected region slug/id in local component state.
- Add a lightweight header/status area showing selected district and `lastUpdated`, formatted as “Never updated” when `0`.

Manual UI test:
- Start Convex and Next dev servers.
- Open `/`.
- Confirm the region switcher loads only:
  - Brahmanbaria
  - Jessore
  - Manikganj
  - Tangail
  - Mymensingh
- Switch districts and confirm the selected district header updates.
- Confirm the app has a useful empty state if regions are not seeded.

Validation:
- `bun run lint`.

## Phase 2: Mock `/predict` API And Manual Ingestion Path

Purpose: create the stable ML boundary and a UI-testable way to ingest predictions into Convex.

Backend:
- Add `lib/regions.ts`.
  - Shared typed constants for the five supported region slugs, display names, centers, and default zooms.
- Add `lib/mock-predict.ts`.
  - Exports deterministic prediction fixtures.
  - 15-25 predictions per region.
  - Coordinates clustered around each district center.
  - Confidence mix:
    - several `> 0.8`
    - several `0.5-0.8`
    - several `0.4-0.5`
    - at least 1-2 `no_kiln` entries per region
  - No `Math.random()` at request time.
- Add `app/predict/route.ts`.
  - Implements exact route `GET /predict?region={region_slug}`.
  - Returns exact shape:
    - `region`
    - `generatedAt`
    - `predictions`
  - Adds deterministic artificial latency, 200-500ms.
  - Returns `400` for missing or unsupported region.
  - Uses `Response.json`.
- Add `convex/predictions.ts`.
  - Internal mutation `upsert`.
  - Preserves `confirmCount` and `falsePositiveCount` on update.
  - Inserts counts as `0` on first insert.
- Add `convex/ingest.ts`.
  - Public action `ingestRegion`.
  - Args: `{ regionSlug: v.string() }`.
  - Looks up region with `internal.regions.getBySlug`.
  - Fetches `${process.env.PREDICT_API_BASE}/predict?region=${regionSlug}`.
  - Validates response shape enough to reject malformed data before writing.
  - Calls `internal.predictions.upsert` for each prediction.
  - Calls `internal.regions.touchLastUpdated` once after all upserts complete.
  - On fetch or validation failure, logs and throws. No retry loop.
- Add `convex/crons.ts`.
  - Schedule ingestion for each of the five slugs every few hours.
  - Keep the same `ingestRegion` action as the only ingestion implementation.

Frontend:
- Add a development operations panel inside `KilnDashboard`.
  - Visible in development only through `process.env.NODE_ENV !== "production"`.
  - shadcn `Card` with one button: “Ingest selected region”.
  - Calls `useAction(api.ingest.ingestRegion)`.
  - Shows pending, success, and error states with `sonner` toast.
  - Refetches naturally through Convex subscriptions after ingestion.
- Add UI state that displays selected region `lastUpdated` after ingestion completes.

Manual UI test:
- Set `PREDICT_API_BASE` to a URL Convex can reach.
  - For local-only testing, use a local Convex backend or expose the Next dev server URL; Convex cloud actions cannot fetch a private `localhost` on the developer machine.
- Open `/predict?region=brahmanbaria` directly and confirm the response shape.
- Open `/`, select a seeded region, click “Ingest selected region”.
- Confirm a success toast.
- Confirm `lastUpdated` changes from “Never updated” to a timestamp.

Validation:
- `bun run lint`.
- Manual route test for one valid and one invalid region.

## Phase 3: Predictions Query, Map, Pins, Loading, And Empty States

Purpose: display ingested prediction data on a Leaflet map.

Backend:
- Add public query `getPredictionsForRegion`.
  - Args: `{ regionId: v.id("regions") }`.
  - Uses `by_region`.
  - Returns all predictions for the region.
  - No summary query.
  - No pagination for the initial dataset because each region has 15-25 mock records.

Frontend:
- Add `components/KilnDashboard/use-kiln-dashboard.ts`.
  - Component-specific hook colocated in `components/KilnDashboard/`.
  - Owns selected region, query results, selected prediction id, derived stats, and action handlers.
- Add `components/KilnMap/index.tsx`.
  - `"use client"`.
  - Dynamically imported from the dashboard with SSR disabled because Leaflet needs browser APIs.
  - Receives selected region center, zoom, predictions, selected prediction id, and selection callback.
  - Renders a normal map even with zero predictions.
- Add `components/KilnMap/map-icon.ts`.
  - Creates Leaflet `divIcon`s for confidence classes.
  - High confidence kiln: red/destructive token.
  - Medium confidence kiln: warning token.
  - Low confidence or `no_kiln`: muted token.
- Add map CSS imports in the appropriate client boundary or global CSS as required by Leaflet.
- Add CSS variables in `app/globals.css` for any missing pin colors, then use Tailwind theme variables/classes. Do not use arbitrary Tailwind color values.
- Add shadcn loading skeleton while predictions load.
- Add empty state text only where it reflects actual data state, not instructions.

Manual UI test:
- Ingest a region from Phase 2.
- Confirm pins appear around the district center.
- Switch regions and confirm the map recenters.
- Confirm regions with no predictions render the map with no pins.
- Confirm pin colors differ by confidence/label.

Validation:
- `bun run lint`.
- Browser smoke test at desktop and mobile widths.

## Phase 4: Detail Panel With Tile Image And Read-Only Counts

Purpose: make individual detections inspectable from the map before adding mutation behavior.

Backend:
- No new Convex functions.
- Continue using `getPredictionsForRegion`.

Frontend:
- Add `components/DetectionDetailPanel/index.tsx`.
  - Uses shadcn `Sheet` on mobile and a right-side panel/card layout on desktop, depending on existing layout constraints.
  - Shows:
    - tile image
    - label badge
    - confidence percentage
    - coordinates
    - confirm count
    - false positive count
- Add `public/tile-placeholder.svg` or another lightweight placeholder asset if none is provided yet.
- Add image fallback handling:
  - If `tileUrl` is empty or image loading fails, show placeholder.
  - Use a small client image component if needed.
- Clicking a map pin selects a prediction and opens/updates the panel.
- Closing the panel clears selected prediction.

Manual UI test:
- Click several pins.
- Confirm the detail panel updates for each selected prediction.
- Break one mock `tileUrl` during local testing or inspect an intentionally missing fixture and confirm the placeholder appears.
- Confirm counts display as read-only numbers.

Validation:
- `bun run lint`.
- Browser smoke test for desktop and mobile panel behavior.

## Phase 5: Public Feedback Mutations With Optimistic UI

Purpose: allow anyone to increment confirm/false-positive counts and see immediate feedback.

Backend:
- Extend `convex/predictions.ts`.
- Add public mutation `confirmPrediction`.
  - Args: `{ id: v.id("predictions") }`.
  - Throws `"Not found"` if missing.
  - Patches `confirmCount + 1`.
- Add public mutation `flagFalsePositive`.
  - Args: `{ id: v.id("predictions") }`.
  - Throws `"Not found"` if missing.
  - Patches `falsePositiveCount + 1`.
- No auth.
- No deduplication.
- No confirmation modal.

Frontend:
- Add feedback buttons to `DetectionDetailPanel`.
  - Use shadcn `Button`.
  - Use Remix icons, not lucide.
  - Button labels should be short and scannable.
- Add optimistic updates through Convex React mutation optimistic update support or local optimistic overlay in `use-kiln-dashboard`.
- Disable only the button currently submitting if using local pending state; do not block the whole panel.
- Show toast on mutation failure and roll back optimistic overlay if local overlay is used.

Manual UI test:
- Click “confirm” on a detection and confirm the number increments immediately.
- Refresh the page and confirm the count persisted.
- Click “false positive” and confirm the same behavior.
- Trigger several clicks and confirm counts keep incrementing with no deduplication.

Validation:
- `bun run lint`.
- Manual repeated-click test.

## Phase 6: Summary Stats Bar

Purpose: add region-level insights computed only from data already fetched for the map.

Backend:
- No new Convex query.
- No new table fields.

Frontend:
- Add `components/SummaryStatsBar/index.tsx`.
- Compute from `getPredictionsForRegion` result in the dashboard hook:
  - total predictions
  - kiln count
  - no-kiln count
  - high-confidence kiln count, `label === "kiln" && confidence > 0.8`
  - average confidence
- Render using shadcn `Card` or compact stat tiles, without nested cards.
- Ensure stats update when switching region or after ingestion.

Manual UI test:
- Select a region with predictions.
- Confirm stats match the visible prediction data.
- Select a region with no predictions and confirm all stats render as zero or neutral values.

Validation:
- `bun run lint`.

## Phase 7: Copy As List Export

Purpose: add the client-only export workflow.

Backend:
- No backend endpoint.
- No Convex function.

Frontend:
- Add `lib/format-predictions.ts`.
  - Pure typed formatter.
  - Input: selected region plus current predictions.
  - Output: markdown/plain text list.
  - Include region name, last updated, and each prediction:
    - label
    - confidence percentage
    - coordinates
    - tile URL
    - confirm count
    - false-positive count
- Add “Copy as list” button to the dashboard toolbar.
  - Uses `navigator.clipboard.writeText`.
  - Disabled when no selected region or predictions query still loading.
  - If there are zero predictions, copies a valid empty-region summary instead of failing.
  - Success/failure toast via `sonner`.

Manual UI test:
- Click copy on a populated region and paste into a text editor.
- Confirm formatting is readable and includes all current predictions.
- Click copy on an empty region and confirm it copies an empty summary.

Validation:
- `bun run lint`.
- Manually inspect pasted output.

## Phase 8: Polish, Edge Cases, And End-To-End Manual QA

Purpose: tighten the full app without adding new scope.

Backend:
- Confirm cron calls all five region slugs.
- Confirm ingestion preserves feedback counts after repeated ingestion.
- Confirm unknown region ingestion throws a useful error.
- Confirm `/predict` never includes Convex-only count fields.
- Confirm no separate stats query exists.

Frontend:
- Add final loading/error/empty states:
  - regions loading
  - predictions loading
  - ingestion pending
  - ingestion error
  - zero predictions
  - broken tile image
- Confirm responsive layout:
  - desktop: map and detail panel can coexist.
  - mobile: map remains usable and detail opens as a sheet/drawer.
- Confirm color usage:
  - any new colors are variables in `app/globals.css`.
  - no Tailwind arbitrary color values.
- Confirm component boundaries:
  - server components by default.
  - `"use client"` only where state, effects, browser APIs, Leaflet, or Convex React hooks require it.
- Confirm no single file has grown too large:
  - dashboard hook colocated under `components/KilnDashboard/`
  - map isolated under `components/KilnMap/`
  - detail panel isolated under `components/DetectionDetailPanel/`
  - formatter in `lib/`

Manual UI test:
- Start clean with seeded regions and no predictions.
- For each of the five regions:
  - select it
  - ingest it
  - confirm pins appear
  - click at least one high-confidence and one low/no-kiln pin
  - increment both feedback counts
  - copy list and paste output
- Re-ingest one region after feedback.
- Confirm feedback counts are preserved.
- Test invalid `/predict?region=unknown`.
- Test mobile viewport.

Validation:
- `bun run lint`.
- `bun run build`.
- Manual browser smoke test.

## Public Interfaces And Types

Convex public queries:
- `api.regions.getRegions`
  - Args: `{}`
  - Used by region switcher and selected-region metadata.
- `api.predictions.getPredictionsForRegion`
  - Args: `{ regionId: Id<"regions"> }`
  - Used by map, detail panel, stats, and copy export.

Convex public mutations:
- `api.predictions.confirmPrediction`
  - Args: `{ id: Id<"predictions"> }`
- `api.predictions.flagFalsePositive`
  - Args: `{ id: Id<"predictions"> }`

Convex public actions:
- `api.ingest.ingestRegion`
  - Args: `{ regionSlug: string }`
  - Used by cron and the development operations panel.

Convex internal functions:
- `internal.regions.getBySlug`
- `internal.regions.touchLastUpdated`
- `internal.predictions.upsert`

Next route:
- `GET /predict?region={region_slug}`
  - Exact response contract from `docs/plan.md`.
  - Does not include feedback counts.
  - Deterministic mock data.
  - 200-500ms artificial latency.

Environment variables:
- `NEXT_PUBLIC_CONVEX_URL`
  - Required by the frontend Convex provider.
- `PREDICT_API_BASE`
  - Required by Convex ingestion.
  - Must point to a URL reachable from the Convex runtime.
  - This is the only value that changes when replacing mock ML with the real ML API.

## Assumptions And Defaults

- Region seeding remains outside this task, matching `docs/plan.md`.
- The UI will show graceful empty states when seeded regions or predictions are missing.
- The development ingestion panel is acceptable because it makes each phase manually testable from the UI; it will be hidden in production.
- No auth will be added.
- No vote deduplication will be added.
- No deployment work will be included.
- Summary stats will always be computed client-side from the predictions already fetched for the map.
- The mock ML service will be implemented as `app/predict/route.ts`, producing URL `/predict`.
- Icons will use `@remixicon/react`, matching `components.json`.
- shadcn components will be added through `bun run shadd <component>`.
