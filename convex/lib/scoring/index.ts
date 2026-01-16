/**
 * Scoring Index
 * Re-exports scoring and decision logic
 */

export {
  targetScorer,
  calculateGeneticEvidenceScore,
  calculateTractabilityScore,
  calculateSafetyRiskScore,
  calculateCompetitiveLandscapeScore,
  calculateCompositeScore,
  type TargetScorer,
} from "./scorer";

export { decisionEngine, type DecisionEngine } from "./decisionEngine";
