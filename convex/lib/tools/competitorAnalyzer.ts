/**
 * CompetitorAnalyzer Tool
 * Analyzes competitive landscape via clinical trials
 * Tracks competitors, failure patterns, and market risk
 */

import {
  CompetitorLandscape,
  ClinicalTrial,
  FailureReasons,
  FAILURE_KEYWORDS,
} from "../types";
import { ctgovClient } from "../clients/ctgovClient";

/**
 * Analyze failure patterns in terminated/withdrawn trials
 */
function analyzeFailurePatterns(
  trials: ClinicalTrial[]
): {
  patterns: string[];
  concerns: string[];
  riskLevel: "HIGH" | "MODERATE" | "LOW";
} {
  const patterns: string[] = [];
  const concerns: string[] = [];

  // Get failed trials
  const failedTrials = trials.filter(
    (t) => t.status === "TERMINATED" || t.status === "WITHDRAWN"
  );

  if (failedTrials.length === 0) {
    return { patterns: [], concerns: [], riskLevel: "LOW" };
  }

  // Count failure categories
  const categoryCounts = {
    safety: 0,
    efficacy: 0,
    business: 0,
    other: 0,
  };

  for (const trial of failedTrials) {
    if (!trial.failureReason) {
      categoryCounts.other++;
      continue;
    }

    const reasonLower = trial.failureReason.toLowerCase();
    let categorized = false;

    for (const keyword of FAILURE_KEYWORDS.safety) {
      if (reasonLower.includes(keyword)) {
        categoryCounts.safety++;
        categorized = true;
        break;
      }
    }

    if (!categorized) {
      for (const keyword of FAILURE_KEYWORDS.efficacy) {
        if (reasonLower.includes(keyword)) {
          categoryCounts.efficacy++;
          categorized = true;
          break;
        }
      }
    }

    if (!categorized) {
      for (const keyword of FAILURE_KEYWORDS.business) {
        if (reasonLower.includes(keyword)) {
          categoryCounts.business++;
          categorized = true;
          break;
        }
      }
    }

    if (!categorized) {
      categoryCounts.other++;
    }
  }

  // Identify patterns
  const totalFailed = failedTrials.length;

  if (categoryCounts.safety > 0) {
    const safetyPct = Math.round((categoryCounts.safety / totalFailed) * 100);
    patterns.push(`${safetyPct}% of failures due to safety concerns`);
    if (safetyPct > 30) {
      concerns.push("High rate of safety-related failures suggests target-related toxicity risk");
    }
  }

  if (categoryCounts.efficacy > 0) {
    const efficacyPct = Math.round((categoryCounts.efficacy / totalFailed) * 100);
    patterns.push(`${efficacyPct}% of failures due to efficacy issues`);
    if (efficacyPct > 40) {
      concerns.push("High rate of efficacy failures suggests challenging biology or patient selection issues");
    }
  }

  // Check phase-specific failures
  const lateStageFailures = failedTrials.filter(
    (t) => t.phase === "Phase 3" || t.phase === "Phase 4"
  );
  if (lateStageFailures.length > 0) {
    patterns.push(`${lateStageFailures.length} late-stage (Phase 3/4) failures`);
    concerns.push("Late-stage failures indicate significant development risk");
  }

  // Determine risk level
  let riskLevel: "HIGH" | "MODERATE" | "LOW" = "LOW";

  if (
    categoryCounts.safety >= 2 ||
    lateStageFailures.length >= 2 ||
    totalFailed >= 5
  ) {
    riskLevel = "HIGH";
  } else if (totalFailed >= 2 || categoryCounts.safety >= 1) {
    riskLevel = "MODERATE";
  }

  return { patterns, concerns, riskLevel };
}

/**
 * Identify key competitors (sponsors with active trials)
 */
function identifyCompetitors(
  trials: ClinicalTrial[]
): Array<{ sponsor: string; trialCount: number; phases: string[] }> {
  const sponsorMap = new Map<
    string,
    { count: number; phases: Set<string> }
  >();

  for (const trial of trials) {
    if (
      trial.sponsor &&
      (trial.status === "RECRUITING" || trial.status === "ACTIVE")
    ) {
      const existing = sponsorMap.get(trial.sponsor) || {
        count: 0,
        phases: new Set<string>(),
      };
      existing.count++;
      existing.phases.add(trial.phase);
      sponsorMap.set(trial.sponsor, existing);
    }
  }

  return Array.from(sponsorMap.entries())
    .map(([sponsor, data]) => ({
      sponsor,
      trialCount: data.count,
      phases: Array.from(data.phases),
    }))
    .sort((a, b) => b.trialCount - a.trialCount);
}

/**
 * Generate comprehensive landscape analysis
 */
function generateLandscapeAnalysis(
  landscape: CompetitorLandscape,
  failureAnalysis: ReturnType<typeof analyzeFailurePatterns>,
  competitors: ReturnType<typeof identifyCompetitors>
): string {
  const parts: string[] = [];

  // Overview
  parts.push(`## Competitive Landscape Analysis for ${landscape.targetId}`);
  parts.push("");
  parts.push(`### Overview`);
  parts.push(`- Total trials: ${landscape.totalTrials}`);
  parts.push(`- Active trials: ${landscape.activeTrials}`);
  parts.push(`- Completed trials: ${landscape.completedTrials}`);
  parts.push(`- Failed trials: ${landscape.failedTrials}`);
  parts.push(`- Competitive risk score: ${(landscape.competitiveRiskScore * 100).toFixed(0)}%`);
  parts.push("");

  // Competitors
  if (competitors.length > 0) {
    parts.push(`### Key Competitors`);
    for (const comp of competitors.slice(0, 5)) {
      parts.push(`- ${comp.sponsor}: ${comp.trialCount} active trial(s) in ${comp.phases.join(", ")}`);
    }
    parts.push("");
  }

  // Failure analysis
  if (failureAnalysis.patterns.length > 0) {
    parts.push(`### Failure Patterns`);
    for (const pattern of failureAnalysis.patterns) {
      parts.push(`- ${pattern}`);
    }
    parts.push("");
  }

  // Concerns
  if (failureAnalysis.concerns.length > 0) {
    parts.push(`### Risk Concerns`);
    for (const concern of failureAnalysis.concerns) {
      parts.push(`- ⚠️ ${concern}`);
    }
    parts.push("");
  }

  // Risk assessment
  parts.push(`### Risk Assessment`);
  parts.push(`Development risk level: **${failureAnalysis.riskLevel}**`);

  if (failureAnalysis.riskLevel === "HIGH") {
    parts.push("Multiple failed trials and/or safety concerns suggest high development risk.");
  } else if (failureAnalysis.riskLevel === "MODERATE") {
    parts.push("Some failures observed but not a clear pattern of target-related issues.");
  } else {
    parts.push("Limited failure history; competitive landscape appears favorable.");
  }

  return parts.join("\n");
}

/**
 * CompetitorAnalyzer - Main tool for competitive landscape analysis
 */
export const competitorAnalyzer = {
  /**
   * Get comprehensive competitive landscape analysis
   * This is the main entry point for competitor analysis
   */
  async analyzeLandscape(
    geneSymbol: string,
    diseaseId: string,
    diseaseName: string
  ): Promise<{
    landscape: CompetitorLandscape;
    failureAnalysis: ReturnType<typeof analyzeFailurePatterns>;
    competitors: ReturnType<typeof identifyCompetitors>;
    fullAnalysis: string;
  }> {
    // Get landscape from ClinicalTrials.gov
    const landscape = await ctgovClient.getCompetitorLandscape(
      geneSymbol,
      diseaseId,
      diseaseName
    );

    // Analyze failure patterns
    const failureAnalysis = analyzeFailurePatterns(landscape.trials);

    // Identify competitors
    const competitors = identifyCompetitors(landscape.trials);

    // Generate full analysis
    const fullAnalysis = generateLandscapeAnalysis(
      landscape,
      failureAnalysis,
      competitors
    );

    return {
      landscape,
      failureAnalysis,
      competitors,
      fullAnalysis,
    };
  },

  /**
   * Quick competitive check
   * Returns basic metrics without full analysis
   */
  async quickCompetitiveCheck(
    geneSymbol: string,
    diseaseName?: string
  ): Promise<{
    hasActiveTrials: boolean;
    hasFailedTrials: boolean;
    trialCount: number;
    riskLevel: "HIGH" | "MODERATE" | "LOW";
  }> {
    const trials = await ctgovClient.searchTrials(geneSymbol, diseaseName, 50);

    const activeTrials = trials.filter(
      (t) => t.status === "RECRUITING" || t.status === "ACTIVE"
    );
    const failedTrials = trials.filter(
      (t) => t.status === "TERMINATED" || t.status === "WITHDRAWN"
    );

    // Quick risk assessment
    let riskLevel: "HIGH" | "MODERATE" | "LOW" = "LOW";
    if (failedTrials.length >= 3) {
      riskLevel = "HIGH";
    } else if (failedTrials.length >= 1 || activeTrials.length >= 5) {
      riskLevel = "MODERATE";
    }

    return {
      hasActiveTrials: activeTrials.length > 0,
      hasFailedTrials: failedTrials.length > 0,
      trialCount: trials.length,
      riskLevel,
    };
  },

  /**
   * Get phase distribution for a target
   */
  async getPhaseDistribution(
    geneSymbol: string,
    diseaseName?: string
  ): Promise<Record<string, number>> {
    return ctgovClient.getPhaseDistribution(geneSymbol, diseaseName);
  },

  /**
   * Get detailed failure reasons
   */
  async getFailureReasons(
    geneSymbol: string,
    diseaseName?: string
  ): Promise<
    Array<{
      trial: ClinicalTrial;
      category: keyof FailureReasons;
      phase: string;
    }>
  > {
    const failedTrials = await ctgovClient.getFailedTrials(
      geneSymbol,
      diseaseName
    );

    return failedTrials.map((trial) => {
      let category: keyof FailureReasons = "other";

      if (trial.failureReason) {
        const reasonLower = trial.failureReason.toLowerCase();

        for (const keyword of FAILURE_KEYWORDS.safety) {
          if (reasonLower.includes(keyword)) {
            category = "safety";
            break;
          }
        }

        if (category === "other") {
          for (const keyword of FAILURE_KEYWORDS.efficacy) {
            if (reasonLower.includes(keyword)) {
              category = "efficacy";
              break;
            }
          }
        }

        if (category === "other") {
          for (const keyword of FAILURE_KEYWORDS.business) {
            if (reasonLower.includes(keyword)) {
              category = "business";
              break;
            }
          }
        }
      }

      return {
        trial,
        category,
        phase: trial.phase,
      };
    });
  },

  /**
   * Assess market opportunity based on trial landscape
   */
  async assessMarketOpportunity(
    geneSymbol: string,
    diseaseId: string,
    diseaseName: string
  ): Promise<{
    opportunityLevel: "HIGH" | "MODERATE" | "LOW" | "VERY_LOW";
    reasoning: string[];
  }> {
    const { landscape, failureAnalysis, competitors } =
      await competitorAnalyzer.analyzeLandscape(
        geneSymbol,
        diseaseId,
        diseaseName
      );

    const reasoning: string[] = [];
    let score = 50; // Start neutral

    // Factor 1: Active competition
    if (landscape.activeTrials === 0) {
      score += 20;
      reasoning.push("No active competitors in clinical development");
    } else if (landscape.activeTrials <= 2) {
      score += 10;
      reasoning.push("Limited competition with few active trials");
    } else if (landscape.activeTrials >= 5) {
      score -= 20;
      reasoning.push("High competition with many active trials");
    }

    // Factor 2: Late-stage competitors
    const lateStageActive = competitors.filter((c) =>
      c.phases.some((p) => p === "Phase 3" || p === "Phase 4")
    );
    if (lateStageActive.length > 0) {
      score -= 25;
      reasoning.push(`${lateStageActive.length} competitor(s) in late-stage development`);
    }

    // Factor 3: Failure history
    if (failureAnalysis.riskLevel === "HIGH") {
      score -= 20;
      reasoning.push("High failure rate suggests challenging target biology");
    } else if (failureAnalysis.riskLevel === "LOW" && landscape.totalTrials > 0) {
      score += 10;
      reasoning.push("Low historical failure rate is encouraging");
    }

    // Factor 4: Safety-related failures
    if (landscape.failureReasons.safety >= 2) {
      score -= 30;
      reasoning.push("Multiple safety-related failures indicate target liability");
    }

    // Factor 5: Completed successful trials
    if (landscape.completedTrials > 0 && landscape.failedTrials === 0) {
      score += 15;
      reasoning.push("Previous trials completed without major failures");
    }

    // Determine opportunity level
    let opportunityLevel: "HIGH" | "MODERATE" | "LOW" | "VERY_LOW";
    if (score >= 70) {
      opportunityLevel = "HIGH";
    } else if (score >= 50) {
      opportunityLevel = "MODERATE";
    } else if (score >= 30) {
      opportunityLevel = "LOW";
    } else {
      opportunityLevel = "VERY_LOW";
    }

    return { opportunityLevel, reasoning };
  },
};

export type CompetitorAnalyzer = typeof competitorAnalyzer;
