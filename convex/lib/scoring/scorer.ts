/**
 * TargetScorer
 * Calculates multi-dimensional scores for target prioritization
 *
 * Composite Score Formula:
 * composite = genetic_evidence * 0.35 +
 *             tractability * 0.25 +
 *             (1 - safety_risk) * 0.25 +  // Inverted (lower risk = higher score)
 *             (1 - competitive_landscape) * 0.15  // Inverted
 */

import {
  AssociationScore,
  Tractability,
  SafetySignal,
  CompetitorLandscape,
  TargetScores,
  SCORE_WEIGHTS,
  GENETIC_EVIDENCE_WEIGHTS,
  SAFETY_SEVERITY_WEIGHTS,
} from "../types";

/**
 * Calculate genetic evidence score from association data
 *
 * Components:
 * - Genetic association: 50%
 * - Somatic mutation: 15%
 * - Literature: 15%
 * - Animal model: 10%
 * - Affected pathway: 10%
 */
export function calculateGeneticEvidenceScore(
  association: AssociationScore | undefined | null
): number {
  if (!association) return 0;

  const score =
    association.geneticAssociation * GENETIC_EVIDENCE_WEIGHTS.geneticAssociation +
    association.somaticMutation * GENETIC_EVIDENCE_WEIGHTS.somaticMutation +
    association.literature * GENETIC_EVIDENCE_WEIGHTS.literature +
    association.animalModel * GENETIC_EVIDENCE_WEIGHTS.animalModel +
    association.affectedPathway * GENETIC_EVIDENCE_WEIGHTS.affectedPathway;

  return Math.min(1.0, score);
}

/**
 * Calculate tractability score from tractability assessment
 *
 * Prioritizes:
 * 1. Small molecule tractability (highest value)
 * 2. Antibody tractability
 * 3. PROTAC/other modalities
 */
export function calculateTractabilityScore(
  tractability: Tractability | undefined | null
): number {
  if (!tractability) return 0;

  let score = 0;

  // Small molecule - highest priority
  if (tractability.smallMolecule?.isAssessed) {
    const smBuckets = tractability.smallMolecule.buckets?.length || 0;
    // More buckets = better tractability
    score += 0.5 * Math.min(1.0, smBuckets / 3);
  }

  // Antibody
  if (tractability.antibody?.isAssessed) {
    const abBuckets = tractability.antibody.buckets?.length || 0;
    score += 0.3 * Math.min(1.0, abBuckets / 2);
  }

  // PROTAC
  if (tractability.protac?.isAssessed) {
    score += 0.1;
  }

  // Other modalities
  if (tractability.otherModalities && tractability.otherModalities.length > 0) {
    score += 0.1 * Math.min(1.0, tractability.otherModalities.length / 2);
  }

  return Math.min(1.0, score);
}

/**
 * Calculate safety risk score from safety signals
 *
 * Based on severity counts:
 * - CRITICAL: 0.4 per signal
 * - HIGH: 0.25 per signal
 * - MODERATE: 0.1 per signal
 * - LOW: 0.03 per signal
 * - INFORMATIONAL: 0.01 per signal
 *
 * +10% bonus if signal has supporting evidence
 */
export function calculateSafetyRiskScore(
  signals: SafetySignal[]
): number {
  if (signals.length === 0) return 0;

  let totalRisk = 0;

  for (const signal of signals) {
    // Base risk from severity
    let signalRisk = SAFETY_SEVERITY_WEIGHTS[signal.severity];

    // Boost if signal has supporting evidence
    if (signal.evidence && signal.evidence.length > 0) {
      signalRisk *= 1.1;
    }

    // Additional boost for investigated signals with findings
    if (signal.investigationSummary) {
      signalRisk *= 1.05;
    }

    totalRisk += signalRisk;
  }

  return Math.min(1.0, totalRisk);
}

/**
 * Calculate competitive landscape score
 *
 * Based on:
 * - Active trials ratio: 40%
 * - Failed trials ratio: 30%
 * - Late-stage trials: 30%
 */
export function calculateCompetitiveLandscapeScore(
  landscape: CompetitorLandscape | undefined | null
): number {
  if (!landscape || landscape.totalTrials === 0) {
    return 0;
  }

  // Use the pre-calculated score from ctgovClient
  return landscape.competitiveRiskScore;
}

/**
 * Calculate composite score from all components
 *
 * Formula:
 * composite = genetic * 0.35 + tractability * 0.25 +
 *             (1 - safety) * 0.25 + (1 - competitive) * 0.15
 */
export function calculateCompositeScore(scores: {
  geneticEvidence: number;
  tractability: number;
  safetyRisk: number;
  competitiveLandscape: number;
}): number {
  const composite =
    scores.geneticEvidence * SCORE_WEIGHTS.geneticEvidence +
    scores.tractability * SCORE_WEIGHTS.tractability +
    (1 - scores.safetyRisk) * SCORE_WEIGHTS.safetyRisk +
    (1 - scores.competitiveLandscape) * SCORE_WEIGHTS.competitiveLandscape;

  return Math.max(0, Math.min(1.0, composite));
}

/**
 * TargetScorer - Main scoring engine
 */
export const targetScorer = {
  /**
   * Calculate all scores for a target
   */
  calculateScores(
    association: AssociationScore | undefined | null,
    tractability: Tractability | undefined | null,
    safetySignals: SafetySignal[],
    competitorLandscape: CompetitorLandscape | undefined | null
  ): TargetScores {
    const geneticEvidence = calculateGeneticEvidenceScore(association);
    const tractabilityScore = calculateTractabilityScore(tractability);
    const safetyRisk = calculateSafetyRiskScore(safetySignals);
    const competitiveLandscape = calculateCompetitiveLandscapeScore(competitorLandscape);

    const compositeScore = calculateCompositeScore({
      geneticEvidence,
      tractability: tractabilityScore,
      safetyRisk,
      competitiveLandscape,
    });

    return {
      geneticEvidence,
      tractability: tractabilityScore,
      safetyRisk,
      competitiveLandscape,
      compositeScore,
    };
  },

  /**
   * Get score interpretation
   */
  interpretScore(scores: TargetScores): {
    overall: "EXCELLENT" | "GOOD" | "MODERATE" | "POOR";
    strengths: string[];
    weaknesses: string[];
  } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    // Evaluate genetic evidence
    if (scores.geneticEvidence >= 0.7) {
      strengths.push("Strong genetic evidence supporting target-disease link");
    } else if (scores.geneticEvidence >= 0.4) {
      strengths.push("Moderate genetic evidence");
    } else if (scores.geneticEvidence < 0.2) {
      weaknesses.push("Weak genetic evidence for target-disease association");
    }

    // Evaluate tractability
    if (scores.tractability >= 0.6) {
      strengths.push("High druggability across multiple modalities");
    } else if (scores.tractability >= 0.3) {
      strengths.push("Tractable by at least one modality");
    } else if (scores.tractability < 0.2) {
      weaknesses.push("Limited druggability options");
    }

    // Evaluate safety
    if (scores.safetyRisk >= 0.6) {
      weaknesses.push("Significant safety concerns identified");
    } else if (scores.safetyRisk >= 0.3) {
      weaknesses.push("Some safety signals require attention");
    } else if (scores.safetyRisk < 0.1) {
      strengths.push("Clean safety profile");
    }

    // Evaluate competition
    if (scores.competitiveLandscape >= 0.6) {
      weaknesses.push("High competitive activity in this space");
    } else if (scores.competitiveLandscape >= 0.3) {
      weaknesses.push("Moderate competitive landscape");
    } else if (scores.competitiveLandscape < 0.2) {
      strengths.push("Favorable competitive landscape");
    }

    // Determine overall rating
    let overall: "EXCELLENT" | "GOOD" | "MODERATE" | "POOR";
    if (scores.compositeScore >= 0.7) {
      overall = "EXCELLENT";
    } else if (scores.compositeScore >= 0.5) {
      overall = "GOOD";
    } else if (scores.compositeScore >= 0.3) {
      overall = "MODERATE";
    } else {
      overall = "POOR";
    }

    return { overall, strengths, weaknesses };
  },

  /**
   * Compare two targets
   */
  compareTargets(
    target1: { symbol: string; scores: TargetScores },
    target2: { symbol: string; scores: TargetScores }
  ): {
    winner: string;
    margin: number;
    advantages: Record<string, string>;
  } {
    const diff = target1.scores.compositeScore - target2.scores.compositeScore;
    const winner = diff >= 0 ? target1.symbol : target2.symbol;

    const advantages: Record<string, string> = {};

    if (target1.scores.geneticEvidence > target2.scores.geneticEvidence) {
      advantages["geneticEvidence"] = target1.symbol;
    } else if (target2.scores.geneticEvidence > target1.scores.geneticEvidence) {
      advantages["geneticEvidence"] = target2.symbol;
    }

    if (target1.scores.tractability > target2.scores.tractability) {
      advantages["tractability"] = target1.symbol;
    } else if (target2.scores.tractability > target1.scores.tractability) {
      advantages["tractability"] = target2.symbol;
    }

    // For safety, lower is better
    if (target1.scores.safetyRisk < target2.scores.safetyRisk) {
      advantages["safety"] = target1.symbol;
    } else if (target2.scores.safetyRisk < target1.scores.safetyRisk) {
      advantages["safety"] = target2.symbol;
    }

    // For competition, lower is better
    if (target1.scores.competitiveLandscape < target2.scores.competitiveLandscape) {
      advantages["competition"] = target1.symbol;
    } else if (target2.scores.competitiveLandscape < target1.scores.competitiveLandscape) {
      advantages["competition"] = target2.symbol;
    }

    return {
      winner,
      margin: Math.abs(diff),
      advantages,
    };
  },

  /**
   * Rank multiple targets by composite score
   */
  rankTargets(
    targets: Array<{ symbol: string; scores: TargetScores }>
  ): Array<{
    rank: number;
    symbol: string;
    compositeScore: number;
    tier: "TOP" | "MID" | "LOW";
  }> {
    const sorted = [...targets].sort(
      (a, b) => b.scores.compositeScore - a.scores.compositeScore
    );

    return sorted.map((target, index) => ({
      rank: index + 1,
      symbol: target.symbol,
      compositeScore: target.scores.compositeScore,
      tier:
        target.scores.compositeScore >= 0.6
          ? "TOP"
          : target.scores.compositeScore >= 0.3
            ? "MID"
            : "LOW",
    }));
  },
};

export type TargetScorer = typeof targetScorer;
