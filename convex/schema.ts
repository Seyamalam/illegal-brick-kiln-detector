import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  regions: defineTable({
    slug: v.string(),
    name: v.string(),
    centerLat: v.number(),
    centerLon: v.number(),
    defaultZoom: v.number(),
    lastUpdated: v.number(),
  }).index("by_slug", ["slug"]),

  predictions: defineTable({
    externalId: v.string(),
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
