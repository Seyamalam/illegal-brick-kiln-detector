import { v } from "convex/values";

import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

const supportedRegions = [
  {
    slug: "brahmanbaria",
    name: "Brahmanbaria",
    centerLat: 23.9571,
    centerLon: 91.1119,
    defaultZoom: 11,
  },
  {
    slug: "jessore",
    name: "Jessore",
    centerLat: 23.1634,
    centerLon: 89.2182,
    defaultZoom: 11,
  },
  {
    slug: "manikganj",
    name: "Manikganj",
    centerLat: 23.8617,
    centerLon: 90.0003,
    defaultZoom: 11,
  },
  {
    slug: "mymensingh",
    name: "Mymensingh",
    centerLat: 24.7471,
    centerLon: 90.4203,
    defaultZoom: 11,
  },
  {
    slug: "tangail",
    name: "Tangail",
    centerLat: 24.2513,
    centerLon: 89.9167,
    defaultZoom: 11,
  },
] as const;

export const getRegions = query({
  args: {},
  handler: async (ctx) => {
    const regions = await ctx.db.query("regions").take(50);

    return regions.toSorted((a, b) => a.name.localeCompare(b.name));
  },
});

export const seedSupportedRegions = mutation({
  args: {},
  handler: async (ctx) => {
    for (const region of supportedRegions) {
      const existing = await ctx.db
        .query("regions")
        .withIndex("by_slug", (q) => q.eq("slug", region.slug))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, region);
      } else {
        await ctx.db.insert("regions", {
          ...region,
          lastUpdated: 0,
        });
      }
    }

    return supportedRegions.length;
  },
});

export const getBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("regions")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});

export const touchLastUpdated = internalMutation({
  args: {
    regionId: v.id("regions"),
    timestamp: v.number(),
  },
  handler: async (ctx, { regionId, timestamp }) => {
    await ctx.db.patch(regionId, { lastUpdated: timestamp });
  },
});
