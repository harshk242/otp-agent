// ============================================================
// OpenTargets Agent Types
// TypeScript equivalent of Python Pydantic models
// ============================================================

// ============================================================
// ENUMS
// ============================================================

export type Verdict = "GO" | "GO_WITH_CAUTION" | "INVESTIGATE_FURTHER" | "NO_GO";

export type SafetySeverity = "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "INFORMATIONAL";

export type SafetyEvidenceType =
  | "PAPER"
  | "COMPOUND"
  | "CLINICAL_TRIAL"
  | "REGULATORY"
  | "ANIMAL_MODEL"
  | "IN_VITRO";

export type TrialStatus =
  | "RECRUITING"
  | "ACTIVE"
  | "COMPLETED"
  | "TERMINATED"
  | "WITHDRAWN"
  | "SUSPENDED"
  | "UNKNOWN";

export type TriageStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type FailureCategory = "safety" | "efficacy" | "business" | "other";

// ============================================================
// TARGET MODELS
// ============================================================

export interface TargetInfo {
  ensemblId: string;
  symbol: string;
  name: string;
  biotype?: string;
  description?: string;
  chromosome?: string;
  start?: number;
  end?: number;
  synonyms?: string[];
}

export interface AssociationScore {
  overallScore: number;
  geneticAssociation: number;
  somaticMutation: number;
  knownDrug: number;
  affectedPathway: number;
  literature: number;
  rnaExpression: number;
  animalModel: number;
}

export interface TractabilityModality {
  modality: string;
  isAssessed: boolean;
  topCategory?: string;
  buckets: string[];
}

export interface Tractability {
  smallMolecule?: TractabilityModality;
  antibody?: TractabilityModality;
  protac?: TractabilityModality;
  otherModalities?: TractabilityModality[];
}

// ============================================================
// SAFETY MODELS
// ============================================================

export interface SafetyEvidence {
  type: SafetyEvidenceType;
  source: string;
  description: string;
  url?: string;
  confidence?: number;
}

export interface SafetySignal {
  signalType: string;
  organSystem?: string;
  severity: SafetySeverity;
  description: string;
  evidence: SafetyEvidence[];
  investigationSummary?: string;
}

export interface SafetyProfile {
  targetId: string;
  signals: SafetySignal[];
  overallRisk: SafetySeverity;
  criticalSignalCount: number;
  highSignalCount: number;
  moderateSignalCount: number;
  lowSignalCount: number;
}

// Critical organ systems that require investigation
export const CRITICAL_ORGAN_SYSTEMS = [
  "liver",
  "heart",
  "kidney",
  "brain",
  "lung",
] as const;

// Signal types that can be investigated
export const INVESTIGATABLE_SIGNAL_TYPES = [
  "target_safety",
  "known_safety_risk",
  "toxic_effect",
  "hepatotoxicity",
  "cardiotoxicity",
  "nephrotoxicity",
  "neurotoxicity",
  "hematological_toxicity",
  "reproductive_toxicity",
  "immunotoxicity",
  "genotoxicity",
] as const;

// ============================================================
// TRIAL MODELS
// ============================================================

export interface ClinicalTrial {
  trialId: string;
  title: string;
  phase: string;
  status: TrialStatus;
  sponsor?: string;
  startDate?: string;
  completionDate?: string;
  enrollment?: number;
  failureReason?: string;
  url?: string;
}

export interface FailureReasons {
  safety: number;
  efficacy: number;
  business: number;
  other: number;
}

export interface CompetitorLandscape {
  targetId: string;
  diseaseId: string;
  totalTrials: number;
  activeTrials: number;
  completedTrials: number;
  failedTrials: number;
  trials: ClinicalTrial[];
  failureReasons: FailureReasons;
  competitiveRiskScore: number;
  landscapeSummary?: string;
}

// Keywords for failure categorization
export const FAILURE_KEYWORDS = {
  safety: [
    "safety",
    "adverse",
    "toxicity",
    "side effect",
    "death",
    "serious",
    "toxic",
    "hepatotoxic",
    "cardiotoxic",
  ],
  efficacy: [
    "efficacy",
    "endpoint",
    "futility",
    "lack of effect",
    "no benefit",
    "ineffective",
    "failed endpoint",
  ],
  business: [
    "business",
    "strategic",
    "funding",
    "sponsor",
    "commercial",
    "financial",
    "discontinued",
  ],
} as const;

// ============================================================
// DRUG MODELS
// ============================================================

export interface KnownDrug {
  drugId: string;
  drugName: string;
  phase?: string;
  status?: string;
  mechanismOfAction?: string;
}

// ============================================================
// SCORING MODELS
// ============================================================

export interface TargetScores {
  geneticEvidence: number;
  tractability: number;
  safetyRisk: number;
  competitiveLandscape: number;
  compositeScore: number;
}

// Scoring weights
export const SCORE_WEIGHTS = {
  geneticEvidence: 0.35,
  tractability: 0.25,
  safetyRisk: 0.25, // Inverted in composite
  competitiveLandscape: 0.15, // Inverted in composite
} as const;

// Genetic evidence component weights
export const GENETIC_EVIDENCE_WEIGHTS = {
  geneticAssociation: 0.5,
  somaticMutation: 0.15,
  literature: 0.15,
  animalModel: 0.1,
  affectedPathway: 0.1,
} as const;

// Safety severity weights for risk calculation
export const SAFETY_SEVERITY_WEIGHTS: Record<SafetySeverity, number> = {
  CRITICAL: 0.4,
  HIGH: 0.25,
  MODERATE: 0.1,
  LOW: 0.03,
  INFORMATIONAL: 0.01,
} as const;

// ============================================================
// REPORT MODELS
// ============================================================

export interface TargetReport {
  targetInfo: TargetInfo;
  diseaseId: string;
  diseaseName: string;
  associationScore?: AssociationScore;
  tractability?: Tractability;
  safetySignals: SafetySignal[];
  competitorLandscape?: CompetitorLandscape;
  knownDrugs?: KnownDrug[];
  scores: TargetScores;
  verdict: Verdict;
  recommendations: string[];
  aiSummary?: string;
  createdAt: number;
}

export interface ReportSummary {
  totalTargets: number;
  goCount: number;
  cautionCount: number;
  investigateCount: number;
  noGoCount: number;
  topTargets: string[];
}

export interface TriageReport {
  diseaseId: string;
  diseaseName: string;
  targetReports: TargetReport[];
  summary: ReportSummary;
  executiveSummary?: string;
  createdAt: number;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

// OpenTargets Platform API types
export interface OTPTargetResponse {
  target: {
    id: string;
    approvedSymbol: string;
    approvedName: string;
    biotype: string;
    genomicLocation?: {
      chromosome: string;
      start: number;
      end: number;
    };
    symbolSynonyms?: { label: string }[];
    functionDescriptions?: string[];
  } | null;
}

export interface OTPAssociationResponse {
  disease: {
    associatedTargets: {
      rows: Array<{
        target: { id: string; approvedSymbol: string };
        score: number;
        datatypeScores: Array<{
          componentId: string;
          score: number;
        }>;
      }>;
    };
  } | null;
}

export interface OTPTractabilityResponse {
  target: {
    tractability: Array<{
      modality: string;
      value: boolean;
      id: string;
    }>;
  } | null;
}

export interface OTPSafetyResponse {
  target: {
    safetyLiabilities: Array<{
      event: string;
      eventId: string;
      effects: Array<{
        direction: string;
        dosing: string;
      }>;
      biosamples: Array<{
        cellLabel: string;
        tissueLabel: string;
      }>;
      datasource: string;
      literature: string;
      url: string;
    }>;
  } | null;
}

export interface OTPKnownDrugsResponse {
  target: {
    knownDrugs: {
      rows: Array<{
        drug: {
          id: string;
          name: string;
        };
        phase: number;
        status: string;
        mechanismOfAction: string;
      }>;
    };
  } | null;
}

// ChEMBL API types
export interface ChEMBLTargetSearchResponse {
  targets: Array<{
    target_chembl_id: string;
    pref_name: string;
    target_type: string;
  }>;
}

export interface ChEMBLMechanismResponse {
  mechanisms: Array<{
    mechanism_of_action: string;
    target_chembl_id: string;
    molecule_chembl_id: string;
    action_type: string;
  }>;
}

export interface ChEMBLCompoundToxicityResponse {
  molecules: Array<{
    molecule_chembl_id: string;
    pref_name: string;
    max_phase: number;
    withdrawn_flag: boolean;
    withdrawn_reason: string;
  }>;
}

// PubMed API types
export interface PubMedSearchResponse {
  esearchresult: {
    idlist: string[];
    count: string;
  };
}

export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  pubDate: string;
  doi?: string;
}

// ClinicalTrials.gov API types
export interface CTGovStudy {
  protocolSection: {
    identificationModule: {
      nctId: string;
      briefTitle: string;
    };
    statusModule: {
      overallStatus: string;
      startDateStruct?: { date: string };
      completionDateStruct?: { date: string };
    };
    designModule?: {
      phases?: string[];
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
  };
}

export interface CTGovSearchResponse {
  studies: CTGovStudy[];
  totalCount: number;
}

// ============================================================
// TRIAGE JOB TYPES
// ============================================================

export interface TriageJobInput {
  genes: Array<{
    symbol: string;
    ensemblId?: string;
  }>;
  diseaseId: string;
  diseaseName: string;
}

export interface TriageProgress {
  status: TriageStatus;
  progress: number;
  currentGene?: string;
  completedGenes: number;
  totalGenes: number;
  error?: string;
}

// ============================================================
// CONFIGURATION
// ============================================================

export interface AgentConfig {
  otpApiUrl: string;
  chemblApiUrl: string;
  pubmedApiUrl: string;
  ctgovApiUrl: string;
  ncbiApiKey?: string;
  maxConcurrentRequests: number;
  requestTimeout: number;
  cacheTtl: number;
}

export const DEFAULT_CONFIG: AgentConfig = {
  otpApiUrl: "https://api.platform.opentargets.org/api/v4/graphql",
  chemblApiUrl: "https://www.ebi.ac.uk/chembl/api/data",
  pubmedApiUrl: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
  ctgovApiUrl: "https://clinicaltrials.gov/api/v2",
  maxConcurrentRequests: 5,
  requestTimeout: 30000, // 30 seconds
  cacheTtl: 3600000, // 1 hour
};
