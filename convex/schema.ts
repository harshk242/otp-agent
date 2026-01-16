import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Define all enums as validators
export const verdictValidator = v.union(
  v.literal("GO"),
  v.literal("GO_WITH_CAUTION"),
  v.literal("INVESTIGATE_FURTHER"),
  v.literal("NO_GO")
);

export const safetySeverityValidator = v.union(
  v.literal("CRITICAL"),
  v.literal("HIGH"),
  v.literal("MODERATE"),
  v.literal("LOW"),
  v.literal("INFORMATIONAL")
);

export const safetyEvidenceTypeValidator = v.union(
  v.literal("PAPER"),
  v.literal("COMPOUND"),
  v.literal("CLINICAL_TRIAL"),
  v.literal("REGULATORY"),
  v.literal("ANIMAL_MODEL"),
  v.literal("IN_VITRO")
);

export const trialStatusValidator = v.union(
  v.literal("RECRUITING"),
  v.literal("ACTIVE"),
  v.literal("COMPLETED"),
  v.literal("TERMINATED"),
  v.literal("WITHDRAWN"),
  v.literal("SUSPENDED"),
  v.literal("UNKNOWN")
);

export const triageStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("RUNNING"),
  v.literal("COMPLETED"),
  v.literal("FAILED")
);

// Nested object validators
export const safetyEvidenceValidator = v.object({
  type: safetyEvidenceTypeValidator,
  source: v.string(),
  description: v.string(),
  url: v.optional(v.string()),
  confidence: v.optional(v.number()),
});

export const safetySignalValidator = v.object({
  signalType: v.string(),
  organSystem: v.optional(v.string()),
  severity: safetySeverityValidator,
  description: v.string(),
  evidence: v.array(safetyEvidenceValidator),
  investigationSummary: v.optional(v.string()),
});

export const tractabilityModalityValidator = v.object({
  modality: v.string(),
  isAssessed: v.boolean(),
  topCategory: v.optional(v.string()),
  buckets: v.array(v.string()),
});

export const tractabilityValidator = v.object({
  smallMolecule: v.optional(tractabilityModalityValidator),
  antibody: v.optional(tractabilityModalityValidator),
  protac: v.optional(tractabilityModalityValidator),
  otherModalities: v.optional(v.array(tractabilityModalityValidator)),
});

export const associationScoreValidator = v.object({
  overallScore: v.number(),
  geneticAssociation: v.number(),
  somaticMutation: v.number(),
  knownDrug: v.number(),
  affectedPathway: v.number(),
  literature: v.number(),
  rnaExpression: v.number(),
  animalModel: v.number(),
});

export const targetInfoValidator = v.object({
  ensemblId: v.string(),
  symbol: v.string(),
  name: v.string(),
  biotype: v.optional(v.string()),
  description: v.optional(v.string()),
  chromosome: v.optional(v.string()),
  start: v.optional(v.number()),
  end: v.optional(v.number()),
  synonyms: v.optional(v.array(v.string())),
});

export const clinicalTrialValidator = v.object({
  trialId: v.string(),
  title: v.string(),
  phase: v.string(),
  status: trialStatusValidator,
  sponsor: v.optional(v.string()),
  startDate: v.optional(v.string()),
  completionDate: v.optional(v.string()),
  enrollment: v.optional(v.number()),
  failureReason: v.optional(v.string()),
  url: v.optional(v.string()),
});

export const competitorLandscapeValidator = v.object({
  targetId: v.string(),
  diseaseId: v.string(),
  totalTrials: v.number(),
  activeTrials: v.number(),
  completedTrials: v.number(),
  failedTrials: v.number(),
  trials: v.array(clinicalTrialValidator),
  failureReasons: v.object({
    safety: v.number(),
    efficacy: v.number(),
    business: v.number(),
    other: v.number(),
  }),
  competitiveRiskScore: v.number(),
  landscapeSummary: v.optional(v.string()),
});

export const targetScoresValidator = v.object({
  geneticEvidence: v.number(),
  tractability: v.number(),
  safetyRisk: v.number(),
  competitiveLandscape: v.number(),
  compositeScore: v.number(),
});

export const targetReportValidator = v.object({
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
  createdAt: v.number(),
});

export const reportSummaryValidator = v.object({
  totalTargets: v.number(),
  goCount: v.number(),
  cautionCount: v.number(),
  investigateCount: v.number(),
  noGoCount: v.number(),
  topTargets: v.array(v.string()),
});

// Access request status validator
export const accessRequestStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("APPROVED"),
  v.literal("REJECTED")
);

// Schema definition
export default defineSchema({
  ...authTables,

  // Extend the users table with custom fields
  users: defineTable({
    // Convex Auth fields
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    // Custom fields for access control
    isApproved: v.optional(v.boolean()),
    isAdmin: v.optional(v.boolean()),
    // Legacy fields from Clerk (for backward compatibility with existing data)
    createdAt: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    tokenIdentifier: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("by_token", ["tokenIdentifier"]),

  // Access requests for early access
  accessRequests: defineTable({
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
    reason: v.optional(v.string()),
    organization: v.optional(v.string()),
    status: accessRequestStatusValidator,
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    reviewNote: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_email", ["email"]),

  // Gene lists for triage
  geneLists: defineTable({
    userId: v.optional(v.id("users")),
    name: v.string(),
    description: v.optional(v.string()),
    genes: v.array(
      v.object({
        symbol: v.string(),
        ensemblId: v.optional(v.string()),
      })
    ),
    diseaseId: v.string(),
    diseaseName: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_disease", ["diseaseId"]),

  // Triage jobs (for tracking long-running triage operations)
  triageJobs: defineTable({
    userId: v.optional(v.id("users")),
    geneListId: v.optional(v.id("geneLists")),
    diseaseId: v.string(),
    diseaseName: v.string(),
    genes: v.array(v.string()),
    status: triageStatusValidator,
    progress: v.number(), // 0-100
    currentGene: v.optional(v.string()),
    error: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Individual target reports
  targetReports: defineTable({
    triageJobId: v.optional(v.id("triageJobs")),
    userId: v.optional(v.id("users")),
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
    createdAt: v.number(),
  })
    .index("by_triage_job", ["triageJobId"])
    .index("by_user", ["userId"])
    .index("by_target", ["targetInfo.ensemblId"])
    .index("by_disease", ["diseaseId"])
    .index("by_verdict", ["verdict"]),

  // Full triage reports (aggregated)
  triageReports: defineTable({
    triageJobId: v.id("triageJobs"),
    userId: v.optional(v.id("users")),
    diseaseId: v.string(),
    diseaseName: v.string(),
    targetReportIds: v.array(v.id("targetReports")),
    summary: reportSummaryValidator,
    executiveSummary: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_triage_job", ["triageJobId"])
    .index("by_user", ["userId"])
    .index("by_disease", ["diseaseId"]),

  // Cache for API responses
  apiCache: defineTable({
    cacheKey: v.string(),
    data: v.any(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_key", ["cacheKey"])
    .index("by_expiry", ["expiresAt"]),
});
