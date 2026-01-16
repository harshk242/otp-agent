import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(userId, { name: args.name });
  },
});

// Access request mutations
export const submitAccessRequest = mutation({
  args: {
    reason: v.optional(v.string()),
    organization: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    // Check if request already exists
    const existing = await ctx.db
      .query("accessRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing && existing.status === "PENDING") {
      throw new Error("Access request already pending");
    }

    // Create or update request
    if (existing) {
      await ctx.db.patch(existing._id, {
        reason: args.reason,
        organization: args.organization,
        status: "PENDING",
        reviewedBy: undefined,
        reviewedAt: undefined,
        reviewNote: undefined,
        createdAt: Date.now(),
      });
    } else {
      await ctx.db.insert("accessRequests", {
        userId,
        email: user.email || "",
        name: user.name || "User",
        reason: args.reason,
        organization: args.organization,
        status: "PENDING",
        createdAt: Date.now(),
      });
    }
  },
});

export const getAccessRequestStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("accessRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

// Admin functions
export const listAccessRequests = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const admin = await ctx.db.get(userId);
    if (!admin?.isAdmin) return [];

    let requests;
    if (args.status && args.status !== "ALL") {
      requests = await ctx.db
        .query("accessRequests")
        .withIndex("by_status", (q) => q.eq("status", args.status as "PENDING" | "APPROVED" | "REJECTED"))
        .collect();
    } else {
      requests = await ctx.db.query("accessRequests").collect();
    }
    return requests;
  },
});

export const approveAccessRequest = mutation({
  args: {
    requestId: v.id("accessRequests"),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const admin = await ctx.db.get(userId);
    if (!admin?.isAdmin) throw new Error("Unauthorized: Admin access required");

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");

    await ctx.db.patch(args.requestId, {
      status: "APPROVED",
      reviewedBy: userId,
      reviewedAt: Date.now(),
      reviewNote: args.reviewNote,
    });

    await ctx.db.patch(request.userId, { isApproved: true });
  },
});

export const rejectAccessRequest = mutation({
  args: {
    requestId: v.id("accessRequests"),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const admin = await ctx.db.get(userId);
    if (!admin?.isAdmin) throw new Error("Unauthorized: Admin access required");

    await ctx.db.patch(args.requestId, {
      status: "REJECTED",
      reviewedBy: userId,
      reviewedAt: Date.now(),
      reviewNote: args.reviewNote,
    });
  },
});

export const listUsers = query({
  args: { approvedOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const admin = await ctx.db.get(userId);
    if (!admin?.isAdmin) return [];

    const users = await ctx.db.query("users").collect();
    if (args.approvedOnly) {
      return users.filter((u) => u.isApproved);
    }
    return users;
  },
});

export const makeAdmin = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const admin = await ctx.db.get(userId);
    if (!admin?.isAdmin) throw new Error("Unauthorized");

    await ctx.db.patch(args.targetUserId, { isAdmin: true, isApproved: true });
  },
});

export const revokeAccess = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const admin = await ctx.db.get(userId);
    if (!admin?.isAdmin) throw new Error("Unauthorized");
    if (args.targetUserId === userId) throw new Error("Cannot revoke own access");

    await ctx.db.patch(args.targetUserId, { isApproved: false });
  },
});

// Bootstrap first admin (run once from Convex dashboard)
export const bootstrapAdmin = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const existingAdmin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isAdmin"), true))
      .first();

    if (existingAdmin) throw new Error("Admin already exists");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, { isAdmin: true, isApproved: true });
  },
});
