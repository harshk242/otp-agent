"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

import {
  TargetInfo,
  AssociationScore,
  Tractability,
  SafetySignal,
  CompetitorLandscape,
  TargetScores,
  Verdict,
  KnownDrug,
  ReportSummary,
} from "./lib/types";
import { otpClient } from "./lib/clients/otpClient";
import { safetyInvestigator } from "./lib/tools/safetyInvestigator";
import { competitorAnalyzer } from "./lib/tools/competitorAnalyzer";
import { targetScorer } from "./lib/scoring/scorer";
import { decisionEngine } from "./lib/scoring/decisionEngine";

/**
 * Agent Orchestration - Main triage execution logic
 */

// Helper to resolve gene symbol to Ensembl ID
async function resolveGeneToEnsembl(
  geneSymbol: string
): Promise<{ ensemblId: string; symbol: string } | null> {
  // Try to search for the target
  const searchResult = await otpClient.searchTarget(geneSymbol);
  if (!searchResult) {
    return null;
  }

  return {
    ensemblId: searchResult.id,
    symbol: geneSymbol,
  };
}

// Triage a single target
async function triageSingleTarget(
  gene: { symbol: string; ensemblId?: string },
  diseaseId: string,
  diseaseName: string
): Promise<{
  targetInfo: TargetInfo;
  associationScore: AssociationScore | null;
  tractability: Tractability | null;
  safetySignals: SafetySignal[];
  competitorLandscape: CompetitorLandscape | null;
  knownDrugs: KnownDrug[];
  scores: TargetScores;
  verdict: Verdict;
  recommendations: string[];
} | null> {
  // Step 1: Resolve Ensembl ID if not provided
  let ensemblId = gene.ensemblId;
  if (!ensemblId) {
    const resolved = await resolveGeneToEnsembl(gene.symbol);
    if (!resolved) {
      console.error(`Could not resolve gene: ${gene.symbol}`);
      return null;
    }
    ensemblId = resolved.ensemblId;
  }

  // Step 2: Get target info
  const targetInfo = await otpClient.getTargetInfo(ensemblId);
  if (!targetInfo) {
    console.error(`Could not get target info for: ${ensemblId}`);
    return null;
  }

  // Step 3: Run parallel data gathering
  const [associationScore, tractability, safetyProfile, competitorAnalysis, knownDrugs] =
    await Promise.all([
      // Get association score
      otpClient.getAssociationScore(ensemblId, diseaseId).catch((e) => {
        console.error(`Error getting association score: ${e}`);
        return null;
      }),

      // Get tractability
      otpClient.getTractability(ensemblId).catch((e) => {
        console.error(`Error getting tractability: ${e}`);
        return null;
      }),

      // Get safety profile (with investigation)
      safetyInvestigator.getSafetyProfile(ensemblId, gene.symbol).catch((e) => {
        console.error(`Error getting safety profile: ${e}`);
        return { targetId: ensemblId, signals: [], overallRisk: "INFORMATIONAL" as const, criticalSignalCount: 0, highSignalCount: 0, moderateSignalCount: 0, lowSignalCount: 0 };
      }),

      // Analyze competitor landscape
      competitorAnalyzer
        .analyzeLandscape(gene.symbol, diseaseId, diseaseName)
        .catch((e) => {
          console.error(`Error analyzing competitors: ${e}`);
          return null;
        }),

      // Get known drugs
      otpClient.getKnownDrugs(ensemblId).catch((e) => {
        console.error(`Error getting known drugs: ${e}`);
        return [];
      }),
    ]);

  // Step 4: Calculate scores
  const scores = targetScorer.calculateScores(
    associationScore,
    tractability,
    safetyProfile.signals,
    competitorAnalysis?.landscape || null
  );

  // Step 5: Determine verdict
  const decision = decisionEngine.determineVerdict(
    scores,
    safetyProfile.signals,
    competitorAnalysis?.landscape || null
  );

  return {
    targetInfo,
    associationScore,
    tractability,
    safetySignals: safetyProfile.signals,
    competitorLandscape: competitorAnalysis?.landscape || null,
    knownDrugs,
    scores,
    verdict: decision.verdict,
    recommendations: decision.recommendations,
  };
}

// Generate executive summary for triage report
function generateExecutiveSummary(
  diseaseName: string,
  summary: ReportSummary,
  topTargets: Array<{ symbol: string; verdict: Verdict; compositeScore: number }>
): string {
  const parts: string[] = [];

  parts.push(`# Target Triage Report for ${diseaseName}`);
  parts.push("");
  parts.push("## Executive Summary");
  parts.push("");
  parts.push(`Analyzed **${summary.totalTargets}** candidate targets.`);
  parts.push("");
  parts.push("### Verdict Distribution");
  parts.push(`- ✅ GO: ${summary.goCount}`);
  parts.push(`- ⚠️ GO WITH CAUTION: ${summary.cautionCount}`);
  parts.push(`- 🔍 INVESTIGATE FURTHER: ${summary.investigateCount}`);
  parts.push(`- ❌ NO GO: ${summary.noGoCount}`);
  parts.push("");

  if (topTargets.length > 0) {
    parts.push("### Top Recommended Targets");
    for (const target of topTargets.slice(0, 5)) {
      const score = (target.compositeScore * 100).toFixed(0);
      const emoji =
        target.verdict === "GO"
          ? "✅"
          : target.verdict === "GO_WITH_CAUTION"
            ? "⚠️"
            : "🔍";
      parts.push(`- ${emoji} **${target.symbol}** - ${target.verdict.replace(/_/g, " ")} (Score: ${score}%)`);
    }
  }

  return parts.join("\n");
}

/**
 * Run full triage for a list of genes
 * This is the main action that orchestrates the entire triage process
 */
export const runTriage = action({
  args: {
    genes: v.array(
      v.object({
        symbol: v.string(),
        ensemblId: v.optional(v.string()),
      })
    ),
    diseaseId: v.string(),
    diseaseName: v.string(),
  },
  handler: async (ctx, args): Promise<{
    jobId: Id<"triageJobs">;
    summary: ReportSummary;
  }> => {
    // Create triage job
    const jobId = await ctx.runMutation(api.triage.createTriageJob, {
      diseaseId: args.diseaseId,
      diseaseName: args.diseaseName,
      genes: args.genes.map((g) => g.symbol),
    });

    // Update status to running
    await ctx.runMutation(api.triage.updateTriageProgress, {
      jobId,
      progress: 0,
      status: "RUNNING",
    });

    const targetReportIds: Id<"targetReports">[] = [];
    const results: Array<{
      symbol: string;
      verdict: Verdict;
      compositeScore: number;
    }> = [];

    // Process each gene
    for (let i = 0; i < args.genes.length; i++) {
      const gene = args.genes[i];
      const progress = Math.round((i / args.genes.length) * 100);

      // Update progress
      await ctx.runMutation(api.triage.updateTriageProgress, {
        jobId,
        progress,
        currentGene: gene.symbol,
      });

      try {
        // Run triage for this target
        const result = await triageSingleTarget(
          gene,
          args.diseaseId,
          args.diseaseName
        );

        if (result) {
          // Save target report
          const reportId = await ctx.runMutation(api.triage.saveTargetReport, {
            triageJobId: jobId,
            targetInfo: result.targetInfo,
            diseaseId: args.diseaseId,
            diseaseName: args.diseaseName,
            associationScore: result.associationScore || undefined,
            tractability: result.tractability || undefined,
            safetySignals: result.safetySignals,
            competitorLandscape: result.competitorLandscape || undefined,
            knownDrugs: result.knownDrugs,
            scores: result.scores,
            verdict: result.verdict,
            recommendations: result.recommendations,
          });

          targetReportIds.push(reportId);
          results.push({
            symbol: result.targetInfo.symbol,
            verdict: result.verdict,
            compositeScore: result.scores.compositeScore,
          });
        }
      } catch (error) {
        console.error(`Error processing ${gene.symbol}:`, error);
        // Continue with other genes
      }
    }

    // Calculate summary
    const summary: ReportSummary = {
      totalTargets: results.length,
      goCount: results.filter((r) => r.verdict === "GO").length,
      cautionCount: results.filter((r) => r.verdict === "GO_WITH_CAUTION").length,
      investigateCount: results.filter((r) => r.verdict === "INVESTIGATE_FURTHER").length,
      noGoCount: results.filter((r) => r.verdict === "NO_GO").length,
      topTargets: results
        .filter((r) => r.verdict === "GO" || r.verdict === "GO_WITH_CAUTION")
        .sort((a, b) => b.compositeScore - a.compositeScore)
        .slice(0, 5)
        .map((r) => r.symbol),
    };

    // Generate executive summary
    const topTargets = results
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, 10);
    const executiveSummary = generateExecutiveSummary(
      args.diseaseName,
      summary,
      topTargets
    );

    // Save triage report
    await ctx.runMutation(api.triage.saveTriageReport, {
      triageJobId: jobId,
      diseaseId: args.diseaseId,
      diseaseName: args.diseaseName,
      targetReportIds,
      summary,
      executiveSummary,
    });

    // Mark job as completed
    await ctx.runMutation(api.triage.updateTriageProgress, {
      jobId,
      progress: 100,
      status: "COMPLETED",
    });

    return { jobId, summary };
  },
});

/**
 * Triage a single target (for individual analysis)
 */
export const triageTarget = action({
  args: {
    geneSymbol: v.string(),
    ensemblId: v.optional(v.string()),
    diseaseId: v.string(),
    diseaseName: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await triageSingleTarget(
      { symbol: args.geneSymbol, ensemblId: args.ensemblId },
      args.diseaseId,
      args.diseaseName
    );

    if (!result) {
      throw new Error(`Could not triage target: ${args.geneSymbol}`);
    }

    // Save the report
    const reportId = await ctx.runMutation(api.triage.saveTargetReport, {
      targetInfo: result.targetInfo,
      diseaseId: args.diseaseId,
      diseaseName: args.diseaseName,
      associationScore: result.associationScore || undefined,
      tractability: result.tractability || undefined,
      safetySignals: result.safetySignals,
      competitorLandscape: result.competitorLandscape || undefined,
      knownDrugs: result.knownDrugs,
      scores: result.scores,
      verdict: result.verdict,
      recommendations: result.recommendations,
    });

    return {
      reportId,
      ...result,
    };
  },
});

/**
 * Get safety profile for a target
 */
export const getSafetyProfile = action({
  args: {
    geneSymbol: v.string(),
    ensemblId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let ensemblId = args.ensemblId;
    if (!ensemblId) {
      const resolved = await resolveGeneToEnsembl(args.geneSymbol);
      if (!resolved) {
        throw new Error(`Could not resolve gene: ${args.geneSymbol}`);
      }
      ensemblId = resolved.ensemblId;
    }

    return await safetyInvestigator.getSafetyProfile(ensemblId, args.geneSymbol);
  },
});

/**
 * Analyze competitors for a target-disease pair
 */
export const analyzeCompetitors = action({
  args: {
    geneSymbol: v.string(),
    diseaseId: v.string(),
    diseaseName: v.string(),
  },
  handler: async (ctx, args) => {
    return await competitorAnalyzer.analyzeLandscape(
      args.geneSymbol,
      args.diseaseId,
      args.diseaseName
    );
  },
});

/**
 * Search for a target by gene symbol
 */
export const searchTarget = action({
  args: {
    geneSymbol: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await otpClient.searchTarget(args.geneSymbol);
    if (!result) {
      return null;
    }

    const targetInfo = await otpClient.getTargetInfo(result.id);
    return targetInfo;
  },
});

/**
 * Search for a disease
 */
export const searchDisease = action({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    return await otpClient.searchDisease(args.query);
  },
});

/**
 * Search for multiple diseases (returns list of matches)
 */
export const searchDiseases = action({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    return await otpClient.searchDiseases(args.query);
  },
});

/**
 * Get target info by Ensembl ID
 */
export const getTargetInfo = action({
  args: {
    ensemblId: v.string(),
  },
  handler: async (ctx, args) => {
    return await otpClient.getTargetInfo(args.ensemblId);
  },
});

/**
 * Get association score between target and disease
 */
export const getAssociationScore = action({
  args: {
    ensemblId: v.string(),
    diseaseId: v.string(),
  },
  handler: async (ctx, args) => {
    return await otpClient.getAssociationScore(args.ensemblId, args.diseaseId);
  },
});

/**
 * Get tractability assessment for a target
 */
export const getTractability = action({
  args: {
    ensemblId: v.string(),
  },
  handler: async (ctx, args) => {
    return await otpClient.getTractability(args.ensemblId);
  },
});

/**
 * Get known drugs for a target
 */
export const getKnownDrugs = action({
  args: {
    ensemblId: v.string(),
  },
  handler: async (ctx, args) => {
    return await otpClient.getKnownDrugs(args.ensemblId);
  },
});
