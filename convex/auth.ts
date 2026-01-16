import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { accessRequestStatusValidator } from "./schema";

/**
 * Authentication and Access Control
 * Handles user registration, access requests, and admin approval flow
 */

// Store or update user from Clerk
export const storeUser = mutation({
  args: {
    tokenIdentifier: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .first();

    if (existingUser) {
      // Update existing user info
      await ctx.db.patch(existingUser._id, {
        name: args.name,
        email: args.email,
        imageUrl: args.imageUrl,
      });
      return existingUser._id;
    }

    // Create new user (not approved by default)
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: args.tokenIdentifier,
      name: args.name,
      email: args.email,
      imageUrl: args.imageUrl,
      isApproved: false,
      isAdmin: false,
      createdAt: Date.now(),
    });

    return userId;
  },
});

// Get current user by token
export const getCurrentUser = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .first();
    return user;
  },
});

// Submit access request
export const submitAccessRequest = mutation({
  args: {
    userId: v.id("users"),
    reason: v.optional(v.string()),
    organization: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if request already exists
    const existingRequest = await ctx.db
      .query("accessRequests")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existingRequest) {
      // Update existing request if it was rejected (allow re-submission)
      if (existingRequest.status === "REJECTED") {
        await ctx.db.patch(existingRequest._id, {
          reason: args.reason,
          organization: args.organization,
          status: "PENDING",
          reviewedBy: undefined,
          reviewedAt: undefined,
          reviewNote: undefined,
          createdAt: Date.now(),
        });
        return existingRequest._id;
      }
      return existingRequest._id;
    }

    // Create new access request
    const requestId = await ctx.db.insert("accessRequests", {
      userId: args.userId,
      email: user.email,
      name: user.name,
      reason: args.reason,
      organization: args.organization,
      status: "PENDING",
      createdAt: Date.now(),
    });

    return requestId;
  },
});

// Get user's access request status
export const getAccessRequestStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const request = await ctx.db
      .query("accessRequests")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    return request;
  },
});

// === ADMIN FUNCTIONS ===

// List all pending access requests (admin only)
export const listAccessRequests = query({
  args: {
    status: v.optional(accessRequestStatusValidator),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("accessRequests")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("accessRequests").order("desc").collect();
  },
});

// Approve access request (admin only)
export const approveAccessRequest = mutation({
  args: {
    requestId: v.id("accessRequests"),
    adminUserId: v.id("users"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify admin
    const admin = await ctx.db.get(args.adminUserId);
    if (!admin || !admin.isAdmin) {
      throw new Error("Unauthorized: Admin access required");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Access request not found");
    }

    // Update request status
    await ctx.db.patch(args.requestId, {
      status: "APPROVED",
      reviewedBy: args.adminUserId,
      reviewedAt: Date.now(),
      reviewNote: args.note,
    });

    // Approve the user
    await ctx.db.patch(request.userId, {
      isApproved: true,
    });

    return true;
  },
});

// Reject access request (admin only)
export const rejectAccessRequest = mutation({
  args: {
    requestId: v.id("accessRequests"),
    adminUserId: v.id("users"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify admin
    const admin = await ctx.db.get(args.adminUserId);
    if (!admin || !admin.isAdmin) {
      throw new Error("Unauthorized: Admin access required");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Access request not found");
    }

    // Update request status
    await ctx.db.patch(args.requestId, {
      status: "REJECTED",
      reviewedBy: args.adminUserId,
      reviewedAt: Date.now(),
      reviewNote: args.note,
    });

    return true;
  },
});

// Make a user admin (requires existing admin)
export const makeAdmin = mutation({
  args: {
    targetUserId: v.id("users"),
    adminUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify admin
    const admin = await ctx.db.get(args.adminUserId);
    if (!admin || !admin.isAdmin) {
      throw new Error("Unauthorized: Admin access required");
    }

    await ctx.db.patch(args.targetUserId, {
      isAdmin: true,
      isApproved: true,
    });

    return true;
  },
});

// Bootstrap first admin (use this once to set up the first admin)
// After setting up, you should remove or disable this function
export const bootstrapAdmin = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if any admin exists
    const existingAdmin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isAdmin"), true))
      .first();

    if (existingAdmin) {
      throw new Error("Admin already exists. Use makeAdmin instead.");
    }

    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("User not found. Please sign in first.");
    }

    // Make them admin
    await ctx.db.patch(user._id, {
      isAdmin: true,
      isApproved: true,
    });

    return user._id;
  },
});

// List all users (admin only)
export const listUsers = query({
  args: {
    approvedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.approvedOnly) {
      return await ctx.db
        .query("users")
        .withIndex("by_approved", (q) => q.eq("isApproved", true))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("users").order("desc").collect();
  },
});

// Revoke user access (admin only)
export const revokeAccess = mutation({
  args: {
    targetUserId: v.id("users"),
    adminUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify admin
    const admin = await ctx.db.get(args.adminUserId);
    if (!admin || !admin.isAdmin) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Don't allow revoking own access
    if (args.targetUserId === args.adminUserId) {
      throw new Error("Cannot revoke your own access");
    }

    await ctx.db.patch(args.targetUserId, {
      isApproved: false,
    });

    return true;
  },
});
