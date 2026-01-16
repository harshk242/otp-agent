import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  verdictValidator,
  safetySignalValidator,
  targetScoresValidator,
  targetInfoValidator,
  associationScoreValidator,
  tractabilityValidator,
  competitorLandscapeValidator,
  reportSummaryValidator,
} from "./schema";

/**
 * Triage Operations - Mutations and queries for target triage
 */

// Create a new triage job
export const createTriageJob = mutation({
  args: {
    diseaseId: v.string(),
    diseaseName: v.string(),
    genes: v.array(v.string()),
    geneListId: v.optional(v.id("geneLists")),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("triageJobs", {
      diseaseId: args.diseaseId,
      diseaseName: args.diseaseName,
      genes: args.genes,
      geneListId: args.geneListId,
      status: "PENDING",
      progress: 0,
      startedAt: Date.now(),
    });

    return jobId;
  },
});

// Update triage job progress
export const updateTriageProgress = mutation({
  args: {
    jobId: v.id("triageJobs"),
    progress: v.number(),
    currentGene: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("PENDING"),
        v.literal("RUNNING"),
        v.literal("COMPLETED"),
        v.literal("FAILED")
      )
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      progress: args.progress,
    };

    if (args.currentGene !== undefined) {
      updates.currentGene = args.currentGene;
    }
    if (args.status !== undefined) {
      updates.status = args.status;
      if (args.status === "COMPLETED" || args.status === "FAILED") {
        updates.completedAt = Date.now();
      }
    }
    if (args.error !== undefined) {
      updates.error = args.error;
    }

    await ctx.db.patch(args.jobId, updates);
  },
});

// Get triage job
export const getTriageJob = query({
  args: { jobId: v.id("triageJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

// List triage jobs
export const listTriageJobs = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("PENDING"),
        v.literal("RUNNING"),
        v.literal("COMPLETED"),
        v.literal("FAILED")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("triageJobs")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("triageJobs").order("desc").collect();
  },
});

// Save a target report
export const saveTargetReport = mutation({
  args: {
    triageJobId: v.optional(v.id("triageJobs")),
    targetInfo: targetInfoValidator,
    diseaseId: v.string(),
    diseaseName: v.string(),
    associationScore: v.optional(associationScoreValidator),
    tractability: v.optional(tractabilityValidator),
    safetySignals: v.array(safetySignalValidator),
    competitorLandscape: v.optional(competitorLandscapeValidator),
    knownDrugs: v.optional(
      v.array(
        v.object({
          drugId: v.string(),
          drugName: v.string(),
          phase: v.optional(v.string()),
          status: v.optional(v.string()),
          mechanismOfAction: v.optional(v.string()),
        })
      )
    ),
    scores: targetScoresValidator,
    verdict: verdictValidator,
    recommendations: v.array(v.string()),
    aiSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const reportId = await ctx.db.insert("targetReports", {
      ...args,
      createdAt: Date.now(),
    });

    return reportId;
  },
});

// Get target report
export const getTargetReport = query({
  args: { reportId: v.id("targetReports") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.reportId);
  },
});

// Get target reports by triage job
export const getTargetReportsByJob = query({
  args: { triageJobId: v.id("triageJobs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("targetReports")
      .withIndex("by_triage_job", (q) => q.eq("triageJobId", args.triageJobId))
      .collect();
  },
});

// Get target reports by verdict
export const getTargetReportsByVerdict = query({
  args: {
    verdict: verdictValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("targetReports")
      .withIndex("by_verdict", (q) => q.eq("verdict", args.verdict))
      .collect();
  },
});

// Save triage report (aggregated)
export const saveTriageReport = mutation({
  args: {
    triageJobId: v.id("triageJobs"),
    diseaseId: v.string(),
    diseaseName: v.string(),
    targetReportIds: v.array(v.id("targetReports")),
    summary: reportSummaryValidator,
    executiveSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const reportId = await ctx.db.insert("triageReports", {
      ...args,
      createdAt: Date.now(),
    });

    return reportId;
  },
});

// Get triage report
export const getTriageReport = query({
  args: { reportId: v.id("triageReports") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.reportId);
  },
});

// Get triage report by job
export const getTriageReportByJob = query({
  args: { triageJobId: v.id("triageJobs") },
  handler: async (ctx, args) => {
    const reports = await ctx.db
      .query("triageReports")
      .withIndex("by_triage_job", (q) => q.eq("triageJobId", args.triageJobId))
      .first();
    return reports;
  },
});

// List triage reports
export const listTriageReports = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("triageReports").order("desc").collect();
  },
});

// Get full triage data (job + reports)
export const getFullTriageData = query({
  args: { triageJobId: v.id("triageJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.triageJobId);
    if (!job) return null;

    const targetReports = await ctx.db
      .query("targetReports")
      .withIndex("by_triage_job", (q) => q.eq("triageJobId", args.triageJobId))
      .collect();

    const triageReport = await ctx.db
      .query("triageReports")
      .withIndex("by_triage_job", (q) => q.eq("triageJobId", args.triageJobId))
      .first();

    return {
      job,
      targetReports,
      triageReport,
    };
  },
});
