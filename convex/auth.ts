import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { query } from "./_generated/server";
import { v } from "convex/values";
import { DataModel } from "./_generated/dataModel";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password<DataModel>({
      profile(params) {
        return {
          email: params.email as string,
          name: params.name as string | undefined,
        };
      },
    }),
  ],
});

// Get current authenticated user
// Accepts optional tokenIdentifier for backwards compatibility with cached Clerk sessions
export const getCurrentUser = query({
  args: {
    tokenIdentifier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // If old Clerk token is passed, ignore it - user needs to re-authenticate
    if (args.tokenIdentifier?.startsWith("clerk|")) {
      return null;
    }
    
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});
