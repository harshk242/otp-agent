import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Gene Lists - CRUD operations for gene lists
 */

// Create a new gene list
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    genes: v.array(
      v.object({
        symbol: v.string(),
        ensemblId: v.optional(v.string()),
      })
    ),
    diseaseId: v.string(),
    diseaseName: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const geneListId = await ctx.db.insert("geneLists", {
      name: args.name,
      description: args.description,
      genes: args.genes,
      diseaseId: args.diseaseId,
      diseaseName: args.diseaseName,
      createdAt: now,
      updatedAt: now,
    });

    return geneListId;
  },
});

// Get a gene list by ID
export const get = query({
  args: { id: v.id("geneLists") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// List all gene lists
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("geneLists").order("desc").collect();
  },
});

// List gene lists by disease
export const listByDisease = query({
  args: { diseaseId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("geneLists")
      .withIndex("by_disease", (q) => q.eq("diseaseId", args.diseaseId))
      .collect();
  },
});

// Update a gene list
export const update = mutation({
  args: {
    id: v.id("geneLists"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    genes: v.optional(
      v.array(
        v.object({
          symbol: v.string(),
          ensemblId: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Gene list not found");
    }

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });

    return id;
  },
});

// Delete a gene list
export const remove = mutation({
  args: { id: v.id("geneLists") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return true;
  },
});

// Add genes to a list
export const addGenes = mutation({
  args: {
    id: v.id("geneLists"),
    genes: v.array(
      v.object({
        symbol: v.string(),
        ensemblId: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Gene list not found");
    }

    // Merge genes, avoiding duplicates by symbol
    const existingSymbols = new Set(existing.genes.map((g) => g.symbol));
    const newGenes = args.genes.filter((g) => !existingSymbols.has(g.symbol));

    await ctx.db.patch(args.id, {
      genes: [...existing.genes, ...newGenes],
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// Remove genes from a list
export const removeGenes = mutation({
  args: {
    id: v.id("geneLists"),
    symbols: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Gene list not found");
    }

    const symbolsToRemove = new Set(args.symbols);
    const remainingGenes = existing.genes.filter(
      (g) => !symbolsToRemove.has(g.symbol)
    );

    await ctx.db.patch(args.id, {
      genes: remainingGenes,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});
