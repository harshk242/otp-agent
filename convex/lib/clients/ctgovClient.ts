/**
 * ClinicalTrials.gov API Client
 * Handles queries to ClinicalTrials.gov for clinical trial data
 */

import {
  DEFAULT_CONFIG,
  ClinicalTrial,
  TrialStatus,
  CompetitorLandscape,
  FailureReasons,
  FAILURE_KEYWORDS,
} from "../types";

const CTGOV_API_URL = DEFAULT_CONFIG.ctgovApiUrl;

interface CTGovStudy {
  protocolSection: {
    identificationModule: {
      nctId: string;
      briefTitle: string;
      officialTitle?: string;
    };
    statusModule: {
      overallStatus: string;
      startDateStruct?: { date: string };
      completionDateStruct?: { date: string };
      whyStopped?: string;
    };
    designModule?: {
      phases?: string[];
      studyType?: string;
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name: string };
    };
    descriptionModule?: {
      briefSummary?: string;
    };
    enrollmentInfo?: {
      count?: number;
    };
    conditionsModule?: {
      conditions?: string[];
    };
    armsInterventionsModule?: {
      interventions?: Array<{
        type: string;
        name: string;
        description?: string;
      }>;
    };
  };
}

interface CTGovResponse {
  studies: CTGovStudy[];
  totalCount: number;
  nextPageToken?: string;
}

// Helper to map API status to our status enum
function mapTrialStatus(apiStatus: string): TrialStatus {
  const statusMap: Record<string, TrialStatus> = {
    RECRUITING: "RECRUITING",
    "NOT_YET_RECRUITING": "RECRUITING",
    "ACTIVE_NOT_RECRUITING": "ACTIVE",
    ACTIVE: "ACTIVE",
    "ENROLLING_BY_INVITATION": "RECRUITING",
    COMPLETED: "COMPLETED",
    TERMINATED: "TERMINATED",
    WITHDRAWN: "WITHDRAWN",
    SUSPENDED: "SUSPENDED",
  };

  return statusMap[apiStatus.toUpperCase().replace(/ /g, "_")] || "UNKNOWN";
}

// Helper to extract phase from phases array
function extractPhase(phases?: string[]): string {
  if (!phases || phases.length === 0) return "Unknown";

  const phase = phases[0];
  if (phase.includes("EARLY_PHASE1") || phase.includes("Phase 1")) return "Phase 1";
  if (phase.includes("PHASE1")) return "Phase 1";
  if (phase.includes("PHASE2")) return "Phase 2";
  if (phase.includes("PHASE3")) return "Phase 3";
  if (phase.includes("PHASE4")) return "Phase 4";
  return phase;
}

// Helper to categorize failure reason
function categorizeFailure(
  reason: string | undefined
): keyof FailureReasons {
  if (!reason) return "other";

  const reasonLower = reason.toLowerCase();

  for (const keyword of FAILURE_KEYWORDS.safety) {
    if (reasonLower.includes(keyword)) return "safety";
  }

  for (const keyword of FAILURE_KEYWORDS.efficacy) {
    if (reasonLower.includes(keyword)) return "efficacy";
  }

  for (const keyword of FAILURE_KEYWORDS.business) {
    if (reasonLower.includes(keyword)) return "business";
  }

  return "other";
}

// Helper for HTTP requests
async function fetchCTGov(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<CTGovResponse | null> {
  const url = new URL(`${CTGOV_API_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`ClinicalTrials.gov request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`ClinicalTrials.gov API error:`, error);
    return null;
  }
}

export const ctgovClient = {
  /**
   * Search for clinical trials by gene and disease
   */
  async searchTrials(
    geneSymbol: string,
    diseaseName?: string,
    maxResults: number = 100
  ): Promise<ClinicalTrial[]> {
    // Build query
    let query = geneSymbol;
    if (diseaseName) {
      query = `${geneSymbol} AND ${diseaseName}`;
    }

    const data = await fetchCTGov("/studies", {
      "query.term": query,
      pageSize: maxResults,
      format: "json",
    });

    if (!data?.studies) return [];

    return data.studies.map((study) => {
      const protocol = study.protocolSection;
      const status = mapTrialStatus(protocol.statusModule.overallStatus);

      // Determine failure reason if terminated or withdrawn
      let failureReason: string | undefined;
      if (status === "TERMINATED" || status === "WITHDRAWN") {
        failureReason = protocol.statusModule.whyStopped;
      }

      return {
        trialId: protocol.identificationModule.nctId,
        title: protocol.identificationModule.briefTitle,
        phase: extractPhase(protocol.designModule?.phases),
        status,
        sponsor: protocol.sponsorCollaboratorsModule?.leadSponsor?.name,
        startDate: protocol.statusModule.startDateStruct?.date,
        completionDate: protocol.statusModule.completionDateStruct?.date,
        enrollment: protocol.enrollmentInfo?.count,
        failureReason,
        url: `https://clinicaltrials.gov/study/${protocol.identificationModule.nctId}`,
      };
    });
  },

  /**
   * Get failed trials for a gene
   */
  async getFailedTrials(
    geneSymbol: string,
    diseaseName?: string
  ): Promise<ClinicalTrial[]> {
    const allTrials = await ctgovClient.searchTrials(geneSymbol, diseaseName, 200);

    // Filter for terminated or withdrawn trials
    return allTrials.filter(
      (trial) => trial.status === "TERMINATED" || trial.status === "WITHDRAWN"
    );
  },

  /**
   * Analyze competitor landscape for a target-disease pair
   */
  async getCompetitorLandscape(
    geneSymbol: string,
    diseaseId: string,
    diseaseName: string
  ): Promise<CompetitorLandscape> {
    const trials = await ctgovClient.searchTrials(geneSymbol, diseaseName, 200);

    // Count trials by status
    let activeTrials = 0;
    let completedTrials = 0;
    let failedTrials = 0;
    const failureReasons: FailureReasons = {
      safety: 0,
      efficacy: 0,
      business: 0,
      other: 0,
    };

    for (const trial of trials) {
      switch (trial.status) {
        case "RECRUITING":
        case "ACTIVE":
        case "SUSPENDED":
          activeTrials++;
          break;
        case "COMPLETED":
          completedTrials++;
          break;
        case "TERMINATED":
        case "WITHDRAWN":
          failedTrials++;
          const category = categorizeFailure(trial.failureReason);
          failureReasons[category]++;
          break;
      }
    }

    // Calculate competitive risk score
    const totalTrials = trials.length;
    let competitiveRiskScore = 0;

    if (totalTrials > 0) {
      // Active trials indicate competition
      const activeRatio = activeTrials / totalTrials;
      // Failed trials indicate difficulty
      const failureRatio = failedTrials / totalTrials;
      // Late-stage trials are more competitive
      const lateStageTrials = trials.filter(
        (t) => t.phase === "Phase 3" || t.phase === "Phase 4"
      ).length;
      const lateStageRatio = lateStageTrials / totalTrials;

      competitiveRiskScore = Math.min(
        1.0,
        activeRatio * 0.4 + failureRatio * 0.3 + lateStageRatio * 0.3
      );
    }

    // Generate landscape summary
    let landscapeSummary = `${totalTrials} clinical trials found for ${geneSymbol} in ${diseaseName}.`;

    if (activeTrials > 0) {
      landscapeSummary += ` ${activeTrials} trials are currently active.`;
    }

    if (failedTrials > 0) {
      landscapeSummary += ` ${failedTrials} trials have failed`;
      if (failureReasons.safety > 0) {
        landscapeSummary += ` (${failureReasons.safety} due to safety concerns)`;
      }
      landscapeSummary += ".";
    }

    if (competitiveRiskScore > 0.7) {
      landscapeSummary += " HIGH competitive risk.";
    } else if (competitiveRiskScore > 0.4) {
      landscapeSummary += " MODERATE competitive risk.";
    } else {
      landscapeSummary += " LOW competitive risk.";
    }

    return {
      targetId: geneSymbol,
      diseaseId,
      totalTrials,
      activeTrials,
      completedTrials,
      failedTrials,
      trials,
      failureReasons,
      competitiveRiskScore,
      landscapeSummary,
    };
  },

  /**
   * Check if a target has any active trials
   */
  async hasActiveTrials(
    geneSymbol: string,
    diseaseName?: string
  ): Promise<boolean> {
    const trials = await ctgovClient.searchTrials(geneSymbol, diseaseName, 50);

    return trials.some(
      (trial) => trial.status === "RECRUITING" || trial.status === "ACTIVE"
    );
  },

  /**
   * Get trial phases distribution
   */
  async getPhaseDistribution(
    geneSymbol: string,
    diseaseName?: string
  ): Promise<Record<string, number>> {
    const trials = await ctgovClient.searchTrials(geneSymbol, diseaseName, 200);

    const distribution: Record<string, number> = {
      "Phase 1": 0,
      "Phase 2": 0,
      "Phase 3": 0,
      "Phase 4": 0,
      Unknown: 0,
    };

    for (const trial of trials) {
      const phase = trial.phase;
      if (phase in distribution) {
        distribution[phase]++;
      } else {
        distribution["Unknown"]++;
      }
    }

    return distribution;
  },
};

export type CTGovClient = typeof ctgovClient;
