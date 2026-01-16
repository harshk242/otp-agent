/**
 * DecisionEngine
 * Determines verdicts and generates recommendations based on scores and signals
 *
 * Verdicts:
 * - GO: Strong candidate for progression
 * - GO_WITH_CAUTION: Proceed but address specific concerns
 * - INVESTIGATE_FURTHER: More data needed before decision
 * - NO_GO: Do not pursue this target
 */

import {
  Verdict,
  TargetScores,
  SafetySignal,
  CompetitorLandscape,
} from "../types";

/**
 * Decision thresholds
 */
const THRESHOLDS = {
  // Composite score thresholds
  GO_SCORE: 0.65,
  CAUTION_SCORE: 0.45,
  INVESTIGATE_SCORE: 0.25,

  // Component thresholds
  MIN_GENETIC_EVIDENCE: 0.2,
  MIN_TRACTABILITY: 0.15,
  MAX_SAFETY_RISK: 0.7,
  MAX_COMPETITIVE_RISK: 0.8,

  // Automatic NO_GO triggers
  CRITICAL_SAFETY_SIGNALS_NOGO: 2,
  HIGH_SAFETY_SIGNALS_NOGO: 4,
};

/**
 * Check for automatic NO_GO conditions
 */
function checkNoGoConditions(
  scores: TargetScores,
  safetySignals: SafetySignal[]
): { isNoGo: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check safety signals
  const criticalCount = safetySignals.filter(
    (s) => s.severity === "CRITICAL"
  ).length;
  const highCount = safetySignals.filter((s) => s.severity === "HIGH").length;

  if (criticalCount >= THRESHOLDS.CRITICAL_SAFETY_SIGNALS_NOGO) {
    reasons.push(`${criticalCount} CRITICAL safety signals identified`);
  }

  if (highCount >= THRESHOLDS.HIGH_SAFETY_SIGNALS_NOGO) {
    reasons.push(`${highCount} HIGH severity safety signals identified`);
  }

  // Check if safety risk is extreme
  if (scores.safetyRisk >= 0.9) {
    reasons.push("Extreme safety risk profile");
  }

  // Check if genetic evidence is essentially absent
  if (scores.geneticEvidence < 0.05) {
    reasons.push("No meaningful genetic evidence for target-disease link");
  }

  return {
    isNoGo: reasons.length > 0,
    reasons,
  };
}

/**
 * Check for caution flags
 */
function checkCautionFlags(
  scores: TargetScores,
  safetySignals: SafetySignal[],
  competitorLandscape: CompetitorLandscape | undefined | null
): string[] {
  const flags: string[] = [];

  // Safety-related caution
  const criticalCount = safetySignals.filter(
    (s) => s.severity === "CRITICAL"
  ).length;
  const highCount = safetySignals.filter((s) => s.severity === "HIGH").length;

  if (criticalCount === 1) {
    flags.push("One CRITICAL safety signal requires attention");
  }

  if (highCount >= 2 && highCount < THRESHOLDS.HIGH_SAFETY_SIGNALS_NOGO) {
    flags.push(`${highCount} HIGH severity safety signals present`);
  }

  if (scores.safetyRisk >= 0.4 && scores.safetyRisk < 0.7) {
    flags.push("Elevated safety risk requires monitoring");
  }

  // Competitive landscape caution
  if (scores.competitiveLandscape >= 0.5) {
    flags.push("Significant competitive activity in this space");
  }

  if (competitorLandscape) {
    if (competitorLandscape.failureReasons.safety >= 2) {
      flags.push("Multiple competitor safety failures - potential target liability");
    }
    if (competitorLandscape.activeTrials >= 5) {
      flags.push("High number of active competitor trials");
    }
  }

  // Tractability caution
  if (scores.tractability < 0.3 && scores.tractability >= THRESHOLDS.MIN_TRACTABILITY) {
    flags.push("Limited tractability options available");
  }

  // Genetic evidence caution
  if (scores.geneticEvidence < 0.3 && scores.geneticEvidence >= THRESHOLDS.MIN_GENETIC_EVIDENCE) {
    flags.push("Moderate genetic evidence - additional validation recommended");
  }

  return flags;
}

/**
 * Check for investigation flags
 */
function checkInvestigationFlags(
  scores: TargetScores,
  safetySignals: SafetySignal[]
): string[] {
  const flags: string[] = [];

  // Uninvestigated high-severity signals
  const uninvestigatedHighSignals = safetySignals.filter(
    (s) =>
      (s.severity === "HIGH" || s.severity === "CRITICAL") &&
      !s.investigationSummary
  );

  if (uninvestigatedHighSignals.length > 0) {
    flags.push(`${uninvestigatedHighSignals.length} high-severity safety signals need deeper investigation`);
  }

  // Borderline scores
  if (scores.compositeScore >= 0.4 && scores.compositeScore < 0.5) {
    flags.push("Borderline composite score - additional data could clarify");
  }

  // Mixed signals
  if (scores.geneticEvidence >= 0.6 && scores.safetyRisk >= 0.5) {
    flags.push("Strong genetics but elevated safety risk - investigate tradeoff");
  }

  if (scores.tractability >= 0.6 && scores.competitiveLandscape >= 0.6) {
    flags.push("Good tractability but high competition - assess differentiation strategy");
  }

  return flags;
}

/**
 * Generate recommendations based on scores and signals
 */
function generateRecommendations(
  verdict: Verdict,
  scores: TargetScores,
  safetySignals: SafetySignal[],
  competitorLandscape: CompetitorLandscape | undefined | null,
  cautionFlags: string[],
  investigationFlags: string[]
): string[] {
  const recommendations: string[] = [];

  switch (verdict) {
    case "GO":
      recommendations.push("Proceed with target development");
      if (scores.tractability >= 0.6) {
        recommendations.push("Consider small molecule approach given strong tractability");
      }
      if (scores.geneticEvidence >= 0.7) {
        recommendations.push("Strong genetic validation supports investment");
      }
      if (scores.competitiveLandscape < 0.2) {
        recommendations.push("First-mover advantage potential in underexplored space");
      }
      break;

    case "GO_WITH_CAUTION":
      recommendations.push("Proceed with defined risk mitigation strategy");
      for (const flag of cautionFlags) {
        if (flag.includes("safety")) {
          recommendations.push("Implement robust safety monitoring from early development");
        }
        if (flag.includes("competitive")) {
          recommendations.push("Develop clear differentiation strategy from competitors");
        }
        if (flag.includes("tractability")) {
          recommendations.push("Explore alternative modalities or combination approaches");
        }
      }
      if (safetySignals.some((s) => s.organSystem)) {
        const organs = [...new Set(safetySignals.map((s) => s.organSystem).filter(Boolean))];
        recommendations.push(`Prioritize ${organs.join(", ")} safety assays`);
      }
      break;

    case "INVESTIGATE_FURTHER":
      recommendations.push("Gather additional data before committing resources");
      for (const flag of investigationFlags) {
        if (flag.includes("safety")) {
          recommendations.push("Complete safety signal investigation");
        }
        if (flag.includes("genetics")) {
          recommendations.push("Seek additional genetic validation studies");
        }
        if (flag.includes("competition")) {
          recommendations.push("Conduct detailed competitive intelligence");
        }
      }
      if (scores.geneticEvidence < THRESHOLDS.MIN_GENETIC_EVIDENCE) {
        recommendations.push("Establish stronger target-disease link through functional studies");
      }
      break;

    case "NO_GO":
      recommendations.push("Do not pursue this target at this time");
      recommendations.push("Document decision rationale for future reference");
      if (scores.safetyRisk >= 0.8) {
        recommendations.push("Safety profile incompatible with development");
      }
      if (scores.geneticEvidence < 0.1) {
        recommendations.push("Insufficient evidence for target-disease association");
      }
      if (competitorLandscape && competitorLandscape.failureReasons.safety >= 3) {
        recommendations.push("Multiple competitor safety failures suggest target-related liability");
      }
      break;
  }

  return recommendations;
}

/**
 * DecisionEngine - Main verdict and recommendation engine
 */
export const decisionEngine = {
  /**
   * Determine verdict for a target
   */
  determineVerdict(
    scores: TargetScores,
    safetySignals: SafetySignal[],
    competitorLandscape: CompetitorLandscape | undefined | null
  ): {
    verdict: Verdict;
    recommendations: string[];
    cautionFlags: string[];
    investigationFlags: string[];
    noGoReasons: string[];
  } {
    // Check NO_GO conditions first
    const noGoCheck = checkNoGoConditions(scores, safetySignals);
    if (noGoCheck.isNoGo) {
      return {
        verdict: "NO_GO",
        recommendations: generateRecommendations(
          "NO_GO",
          scores,
          safetySignals,
          competitorLandscape,
          [],
          []
        ),
        cautionFlags: [],
        investigationFlags: [],
        noGoReasons: noGoCheck.reasons,
      };
    }

    // Get caution and investigation flags
    const cautionFlags = checkCautionFlags(scores, safetySignals, competitorLandscape);
    const investigationFlags = checkInvestigationFlags(scores, safetySignals);

    // Determine verdict based on scores and flags
    let verdict: Verdict;

    if (scores.compositeScore >= THRESHOLDS.GO_SCORE && cautionFlags.length === 0) {
      verdict = "GO";
    } else if (scores.compositeScore >= THRESHOLDS.CAUTION_SCORE) {
      if (cautionFlags.length > 0) {
        verdict = "GO_WITH_CAUTION";
      } else if (investigationFlags.length > 0) {
        verdict = "INVESTIGATE_FURTHER";
      } else {
        verdict = "GO_WITH_CAUTION"; // Default for middle scores
      }
    } else if (scores.compositeScore >= THRESHOLDS.INVESTIGATE_SCORE) {
      verdict = "INVESTIGATE_FURTHER";
    } else {
      // Very low score but not automatic NO_GO
      if (investigationFlags.length > 0) {
        verdict = "INVESTIGATE_FURTHER";
      } else {
        verdict = "NO_GO";
      }
    }

    // Apply overrides for specific conditions
    // High safety risk should at minimum trigger caution
    if (scores.safetyRisk >= 0.5 && verdict === "GO") {
      verdict = "GO_WITH_CAUTION";
    }

    // Multiple investigation flags should trigger investigation
    if (investigationFlags.length >= 3 && verdict === "GO_WITH_CAUTION") {
      verdict = "INVESTIGATE_FURTHER";
    }

    const recommendations = generateRecommendations(
      verdict,
      scores,
      safetySignals,
      competitorLandscape,
      cautionFlags,
      investigationFlags
    );

    return {
      verdict,
      recommendations,
      cautionFlags,
      investigationFlags,
      noGoReasons: [],
    };
  },

  /**
   * Generate executive summary for a verdict
   */
  generateSummary(
    targetSymbol: string,
    diseaseName: string,
    verdict: Verdict,
    scores: TargetScores,
    recommendations: string[]
  ): string {
    const parts: string[] = [];

    // Header
    parts.push(`## Target Assessment: ${targetSymbol} for ${diseaseName}`);
    parts.push("");

    // Verdict
    const verdictEmoji = {
      GO: "✅",
      GO_WITH_CAUTION: "⚠️",
      INVESTIGATE_FURTHER: "🔍",
      NO_GO: "❌",
    };
    parts.push(`### Verdict: ${verdictEmoji[verdict]} ${verdict.replace(/_/g, " ")}`);
    parts.push("");

    // Scores
    parts.push("### Scores");
    parts.push(`- **Composite Score:** ${(scores.compositeScore * 100).toFixed(0)}%`);
    parts.push(`- Genetic Evidence: ${(scores.geneticEvidence * 100).toFixed(0)}%`);
    parts.push(`- Tractability: ${(scores.tractability * 100).toFixed(0)}%`);
    parts.push(`- Safety Risk: ${(scores.safetyRisk * 100).toFixed(0)}%`);
    parts.push(`- Competitive Landscape: ${(scores.competitiveLandscape * 100).toFixed(0)}%`);
    parts.push("");

    // Recommendations
    parts.push("### Recommendations");
    for (const rec of recommendations) {
      parts.push(`- ${rec}`);
    }

    return parts.join("\n");
  },

  /**
   * Quick verdict based on scores only (no full analysis)
   */
  quickVerdict(scores: TargetScores): Verdict {
    if (scores.safetyRisk >= 0.8) return "NO_GO";
    if (scores.geneticEvidence < 0.1) return "NO_GO";

    if (scores.compositeScore >= THRESHOLDS.GO_SCORE) return "GO";
    if (scores.compositeScore >= THRESHOLDS.CAUTION_SCORE) return "GO_WITH_CAUTION";
    if (scores.compositeScore >= THRESHOLDS.INVESTIGATE_SCORE) return "INVESTIGATE_FURTHER";

    return "NO_GO";
  },

  /**
   * Get verdict explanation
   */
  getVerdictExplanation(verdict: Verdict): {
    title: string;
    description: string;
    nextSteps: string[];
  } {
    const explanations: Record<
      Verdict,
      { title: string; description: string; nextSteps: string[] }
    > = {
      GO: {
        title: "Proceed with Development",
        description:
          "This target shows strong evidence for disease association, favorable tractability, acceptable safety profile, and manageable competitive landscape.",
        nextSteps: [
          "Initiate lead identification/optimization",
          "Begin target engagement assays",
          "Plan biomarker strategy",
          "Prepare disease model validation",
        ],
      },
      GO_WITH_CAUTION: {
        title: "Proceed with Risk Mitigation",
        description:
          "This target shows promise but has identified risks that require active management during development.",
        nextSteps: [
          "Define risk mitigation strategy",
          "Establish early safety monitoring",
          "Create decision criteria for stage gates",
          "Plan differentiation studies if competitive concerns",
        ],
      },
      INVESTIGATE_FURTHER: {
        title: "More Data Needed",
        description:
          "Current evidence is insufficient to make a confident go/no-go decision. Additional investigation is recommended.",
        nextSteps: [
          "Complete outstanding safety investigations",
          "Gather additional genetic validation",
          "Conduct competitive intelligence",
          "Set timeline for re-evaluation",
        ],
      },
      NO_GO: {
        title: "Do Not Pursue",
        description:
          "Significant concerns have been identified that make this target unsuitable for development at this time.",
        nextSteps: [
          "Document decision rationale",
          "Archive findings for future reference",
          "Consider related targets with better profiles",
          "Monitor for new data that might change assessment",
        ],
      },
    };

    return explanations[verdict];
  },
};

export type DecisionEngine = typeof decisionEngine;
