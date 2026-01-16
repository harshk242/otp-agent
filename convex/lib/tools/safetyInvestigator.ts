/**
 * SafetyInvestigator Tool
 * Agentic tool for deep investigation of safety signals
 * Auto-investigates critical signals using ChEMBL and PubMed
 */

import {
  SafetySignal,
  SafetyEvidence,
  SafetySeverity,
  SafetyProfile,
  CRITICAL_ORGAN_SYSTEMS,
  INVESTIGATABLE_SIGNAL_TYPES,
} from "../types";
import { otpClient } from "../clients/otpClient";
import { chemblClient } from "../clients/chemblClient";
import { pubmedClient } from "../clients/pubmedClient";

// Severity ordering for comparison
const SEVERITY_ORDER: Record<SafetySeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MODERATE: 2,
  LOW: 1,
  INFORMATIONAL: 0,
};

/**
 * Check if a signal needs investigation
 */
function needsInvestigation(signal: SafetySignal): boolean {
  // Check severity
  if (signal.severity === "CRITICAL" || signal.severity === "HIGH") {
    return true;
  }

  // Check organ system
  if (
    signal.organSystem &&
    CRITICAL_ORGAN_SYSTEMS.some((organ) =>
      signal.organSystem?.toLowerCase().includes(organ)
    )
  ) {
    return true;
  }

  // Check signal type
  if (
    INVESTIGATABLE_SIGNAL_TYPES.some((type) =>
      signal.signalType.toLowerCase().includes(type)
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Investigate a specific safety signal
 */
async function investigateSignal(
  geneSymbol: string,
  signal: SafetySignal
): Promise<SafetyEvidence[]> {
  const evidence: SafetyEvidence[] = [];

  // Run parallel investigations
  const investigations: Promise<SafetyEvidence[]>[] = [];

  // 1. ChEMBL compound toxicity search
  if (signal.organSystem) {
    investigations.push(
      chemblClient.searchAdverseEffects(geneSymbol, signal.organSystem)
    );
  }

  // 2. PubMed toxicity papers
  investigations.push(
    pubmedClient.searchToxicityPapers(geneSymbol, signal.signalType, 5)
  );

  // 3. PubMed organ-specific toxicity
  if (signal.organSystem) {
    investigations.push(
      pubmedClient.searchOrganToxicityPapers(geneSymbol, signal.organSystem, 3)
    );
  }

  // 4. ChEMBL withdrawn drugs
  const withdrawnDrugsPromise = chemblClient
    .getWithdrawnDrugsForTarget(geneSymbol)
    .then((drugs) =>
      drugs.map(
        (drug): SafetyEvidence => ({
          type: "REGULATORY",
          source: "ChEMBL",
          description: `Withdrawn drug: ${drug.drugName} - ${drug.withdrawnReason}`,
          url: `https://www.ebi.ac.uk/chembl/compound_report_card/${drug.chemblId}/`,
          confidence: 0.95,
        })
      )
    );
  investigations.push(withdrawnDrugsPromise);

  // 5. PubMed clinical safety papers
  investigations.push(pubmedClient.searchClinicalSafetyPapers(geneSymbol, 3));

  // 6. PubMed animal model papers
  investigations.push(pubmedClient.searchAnimalModelPapers(geneSymbol, 3));

  // Wait for all investigations
  const results = await Promise.allSettled(investigations);

  // Collect all successful evidence
  for (const result of results) {
    if (result.status === "fulfilled") {
      evidence.push(...result.value);
    }
  }

  return evidence;
}

/**
 * Generate investigation summary
 */
function generateInvestigationSummary(
  signal: SafetySignal,
  newEvidence: SafetyEvidence[]
): string {
  const evidenceCounts = {
    PAPER: 0,
    COMPOUND: 0,
    CLINICAL_TRIAL: 0,
    REGULATORY: 0,
    ANIMAL_MODEL: 0,
    IN_VITRO: 0,
  };

  for (const e of newEvidence) {
    evidenceCounts[e.type]++;
  }

  const parts: string[] = [];

  parts.push(`Investigation of ${signal.signalType} signal`);

  if (signal.organSystem) {
    parts.push(`for ${signal.organSystem}`);
  }

  parts.push(`: Found ${newEvidence.length} pieces of supporting evidence.`);

  const typeSummaries: string[] = [];
  if (evidenceCounts.REGULATORY > 0) {
    typeSummaries.push(`${evidenceCounts.REGULATORY} regulatory actions`);
  }
  if (evidenceCounts.COMPOUND > 0) {
    typeSummaries.push(`${evidenceCounts.COMPOUND} compound-related findings`);
  }
  if (evidenceCounts.PAPER > 0) {
    typeSummaries.push(`${evidenceCounts.PAPER} literature references`);
  }
  if (evidenceCounts.CLINICAL_TRIAL > 0) {
    typeSummaries.push(`${evidenceCounts.CLINICAL_TRIAL} clinical trial findings`);
  }
  if (evidenceCounts.ANIMAL_MODEL > 0) {
    typeSummaries.push(`${evidenceCounts.ANIMAL_MODEL} animal model studies`);
  }

  if (typeSummaries.length > 0) {
    parts.push(` Evidence includes: ${typeSummaries.join(", ")}.`);
  }

  // Add severity assessment
  if (newEvidence.some((e) => e.confidence && e.confidence > 0.8)) {
    parts.push(" HIGH confidence in safety concern.");
  }

  return parts.join("");
}

/**
 * Calculate overall risk severity from signals
 */
function calculateOverallRisk(signals: SafetySignal[]): SafetySeverity {
  if (signals.length === 0) return "INFORMATIONAL";

  // Find the highest severity
  let maxSeverity: SafetySeverity = "INFORMATIONAL";

  for (const signal of signals) {
    if (SEVERITY_ORDER[signal.severity] > SEVERITY_ORDER[maxSeverity]) {
      maxSeverity = signal.severity;
    }
  }

  // If multiple HIGH signals, escalate to CRITICAL
  const highCount = signals.filter((s) => s.severity === "HIGH").length;
  if (highCount >= 3 && maxSeverity === "HIGH") {
    maxSeverity = "CRITICAL";
  }

  return maxSeverity;
}

/**
 * SafetyInvestigator - Main agentic tool for safety profiling
 */
export const safetyInvestigator = {
  /**
   * Get comprehensive safety profile for a target
   * This is the main entry point that orchestrates all safety investigations
   */
  async getSafetyProfile(
    ensemblId: string,
    geneSymbol: string
  ): Promise<SafetyProfile> {
    // Step 1: Get initial safety signals from Open Targets
    const initialSignals = await otpClient.getSafetyLiabilities(ensemblId);

    // Step 2: Identify signals that need investigation
    const signalsToInvestigate = initialSignals.filter(needsInvestigation);

    // Step 3: Investigate each signal (in parallel)
    const investigationPromises = signalsToInvestigate.map(async (signal) => {
      const newEvidence = await investigateSignal(geneSymbol, signal);

      // Add new evidence to signal
      const investigatedSignal: SafetySignal = {
        ...signal,
        evidence: [...signal.evidence, ...newEvidence],
        investigationSummary: generateInvestigationSummary(signal, newEvidence),
      };

      // Potentially upgrade severity if strong evidence found
      if (
        newEvidence.some(
          (e) => e.type === "REGULATORY" && e.confidence && e.confidence > 0.9
        )
      ) {
        if (
          investigatedSignal.severity !== "CRITICAL" &&
          SEVERITY_ORDER[investigatedSignal.severity] < SEVERITY_ORDER["HIGH"]
        ) {
          investigatedSignal.severity = "HIGH";
        }
      }

      return investigatedSignal;
    });

    const investigatedSignals = await Promise.all(investigationPromises);

    // Step 4: Merge investigated signals back with uninvestigated ones
    const investigatedIds = new Set(
      signalsToInvestigate.map((s) => s.signalType + (s.organSystem || ""))
    );
    const uninvestigatedSignals = initialSignals.filter(
      (s) => !investigatedIds.has(s.signalType + (s.organSystem || ""))
    );

    const allSignals = [...investigatedSignals, ...uninvestigatedSignals];

    // Step 5: Calculate counts
    const criticalCount = allSignals.filter(
      (s) => s.severity === "CRITICAL"
    ).length;
    const highCount = allSignals.filter((s) => s.severity === "HIGH").length;
    const moderateCount = allSignals.filter(
      (s) => s.severity === "MODERATE"
    ).length;
    const lowCount = allSignals.filter(
      (s) => s.severity === "LOW" || s.severity === "INFORMATIONAL"
    ).length;

    // Step 6: Build safety profile
    return {
      targetId: ensemblId,
      signals: allSignals,
      overallRisk: calculateOverallRisk(allSignals),
      criticalSignalCount: criticalCount,
      highSignalCount: highCount,
      moderateSignalCount: moderateCount,
      lowSignalCount: lowCount,
    };
  },

  /**
   * Quick safety check without full investigation
   * Useful for initial screening
   */
  async quickSafetyCheck(
    ensemblId: string
  ): Promise<{ hasCriticalSignals: boolean; signalCount: number }> {
    const signals = await otpClient.getSafetyLiabilities(ensemblId);

    const hasCritical = signals.some(
      (s) => s.severity === "CRITICAL" || s.severity === "HIGH"
    );

    return {
      hasCriticalSignals: hasCritical,
      signalCount: signals.length,
    };
  },

  /**
   * Investigate specific organ system toxicity
   */
  async investigateOrganToxicity(
    _ensemblId: string,
    geneSymbol: string,
    organSystem: string
  ): Promise<SafetySignal> {
    // Create a synthetic signal for this organ system
    const signal: SafetySignal = {
      signalType: `${organSystem}_toxicity`,
      organSystem,
      severity: "MODERATE",
      description: `Investigation of potential ${organSystem} toxicity`,
      evidence: [],
    };

    // Investigate
    const evidence = await investigateSignal(geneSymbol, signal);

    // Upgrade severity based on findings
    let severity: SafetySeverity = "MODERATE";
    if (evidence.some((e) => e.type === "REGULATORY")) {
      severity = "HIGH";
    }
    if (
      evidence.filter((e) => e.confidence && e.confidence > 0.8).length >= 3
    ) {
      severity = "HIGH";
    }

    return {
      ...signal,
      severity,
      evidence,
      investigationSummary: generateInvestigationSummary(signal, evidence),
    };
  },

  /**
   * Search for toxicity papers
   */
  async searchToxicityPapers(
    geneSymbol: string,
    toxicityType?: string
  ): Promise<SafetyEvidence[]> {
    return pubmedClient.searchToxicityPapers(geneSymbol, toxicityType);
  },
};

export type SafetyInvestigator = typeof safetyInvestigator;
