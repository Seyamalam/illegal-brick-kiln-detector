import { v } from "convex/values";

import {
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";

export const getRegions = query({
  args: {},
  handler: async (ctx) => {
    const regions = await ctx.db.query("regions").take(50);

    return regions.toSorted((a, b) => a.name.localeCompare(b.name));
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
