/**
 * Test script for API clients
 * Run with: bun run scripts/test-apis.ts
 */

// Use relative imports since we're not in convex runtime
import { otpClient } from "../convex/lib/clients/otpClient";
import { chemblClient } from "../convex/lib/clients/chemblClient";
import { pubmedClient } from "../convex/lib/clients/pubmedClient";
import { ctgovClient } from "../convex/lib/clients/ctgovClient";
import { safetyInvestigator } from "../convex/lib/tools/safetyInvestigator";
import { competitorAnalyzer } from "../convex/lib/tools/competitorAnalyzer";
import { targetScorer } from "../convex/lib/scoring/scorer";
import { decisionEngine } from "../convex/lib/scoring/decisionEngine";

async function testOpenTargets() {
  console.log("\n=== Testing Open Targets Platform API ===\n");

  // Test target search
  console.log("1. Searching for target PNPLA3...");
  const searchResult = await otpClient.searchTarget("PNPLA3");
  console.log("Search result:", searchResult);

  if (searchResult) {
    // Test target info
    console.log("\n2. Getting target info...");
    const targetInfo = await otpClient.getTargetInfo(searchResult.id);
    console.log("Target info:", targetInfo);

    // Test association score
    console.log("\n3. Getting association score for NAFLD (EFO_0001422)...");
    const association = await otpClient.getAssociationScore(
      searchResult.id,
      "EFO_0001422"
    );
    console.log("Association score:", association);

    // Test tractability
    console.log("\n4. Getting tractability...");
    const tractability = await otpClient.getTractability(searchResult.id);
    console.log("Tractability:", tractability);

    // Test safety liabilities
    console.log("\n5. Getting safety liabilities...");
    const safetySignals = await otpClient.getSafetyLiabilities(searchResult.id);
    console.log(`Found ${safetySignals.length} safety signals`);

    // Test known drugs
    console.log("\n6. Getting known drugs...");
    const drugs = await otpClient.getKnownDrugs(searchResult.id);
    console.log(`Found ${drugs.length} known drugs`);
  }
}

async function testChEMBL() {
  console.log("\n=== Testing ChEMBL API ===\n");

  // Test target search
  console.log("1. Searching for ChEMBL target PNPLA3...");
  const target = await chemblClient.searchTargetByGene("PNPLA3");
  console.log("ChEMBL target:", target);

  if (target) {
    // Test mechanisms
    console.log("\n2. Getting mechanisms of action...");
    const mechanisms = await chemblClient.getMechanismsForTarget(
      target.targetChemblId
    );
    console.log(`Found ${mechanisms.length} mechanisms`);
  }

  // Test withdrawn drugs
  console.log("\n3. Searching for withdrawn drugs...");
  const withdrawnDrugs = await chemblClient.getWithdrawnDrugsForTarget("CCR5");
  console.log(`Found ${withdrawnDrugs.length} withdrawn drugs for CCR5`);
}

async function testPubMed() {
  console.log("\n=== Testing PubMed API ===\n");

  // Test toxicity papers search
  console.log("1. Searching for toxicity papers for PNPLA3...");
  const papers = await pubmedClient.searchToxicityPapers("PNPLA3", undefined, 5);
  console.log(`Found ${papers.length} papers`);
  if (papers.length > 0) {
    console.log("First paper:", papers[0]);
  }
}

async function testClinicalTrials() {
  console.log("\n=== Testing ClinicalTrials.gov API ===\n");

  // Test trial search
  console.log("1. Searching for clinical trials for PNPLA3...");
  const trials = await ctgovClient.searchTrials("PNPLA3", "fatty liver", 10);
  console.log(`Found ${trials.length} trials`);
  if (trials.length > 0) {
    console.log("First trial:", trials[0]);
  }

  // Test competitor landscape
  console.log("\n2. Getting competitor landscape...");
  const landscape = await ctgovClient.getCompetitorLandscape(
    "PNPLA3",
    "EFO_0001422",
    "Non-alcoholic fatty liver disease"
  );
  console.log("Landscape summary:", landscape.landscapeSummary);
  console.log("Competitive risk score:", landscape.competitiveRiskScore);
}

async function testTools() {
  console.log("\n=== Testing Agentic Tools ===\n");

  // First get the target ID
  const searchResult = await otpClient.searchTarget("PNPLA3");
  if (!searchResult) {
    console.log("Could not find PNPLA3");
    return;
  }

  // Test Safety Investigator
  console.log("1. Testing Safety Investigator...");
  console.log("(This may take a while as it queries multiple sources)\n");

  const safetyProfile = await safetyInvestigator.getSafetyProfile(
    searchResult.id,
    "PNPLA3"
  );
  console.log("Safety profile:");
  console.log("  Overall risk:", safetyProfile.overallRisk);
  console.log("  Critical signals:", safetyProfile.criticalSignalCount);
  console.log("  High signals:", safetyProfile.highSignalCount);
  console.log("  Moderate signals:", safetyProfile.moderateSignalCount);
  console.log("  Total signals:", safetyProfile.signals.length);

  // Test Competitor Analyzer
  console.log("\n2. Testing Competitor Analyzer...");
  const competitorResult = await competitorAnalyzer.analyzeLandscape(
    "PNPLA3",
    "EFO_0001422",
    "Non-alcoholic fatty liver disease"
  );
  console.log("Competitor analysis:");
  console.log("  Total trials:", competitorResult.landscape.totalTrials);
  console.log("  Active trials:", competitorResult.landscape.activeTrials);
  console.log("  Failed trials:", competitorResult.landscape.failedTrials);
  console.log("  Risk score:", competitorResult.landscape.competitiveRiskScore);
}

async function testScoring() {
  console.log("\n=== Testing Scoring System ===\n");

  // Get all data for a target
  const searchResult = await otpClient.searchTarget("PNPLA3");
  if (!searchResult) {
    console.log("Could not find PNPLA3");
    return;
  }

  const [association, tractability, safetySignals, competitorResult] =
    await Promise.all([
      otpClient.getAssociationScore(searchResult.id, "EFO_0001422"),
      otpClient.getTractability(searchResult.id),
      otpClient.getSafetyLiabilities(searchResult.id),
      competitorAnalyzer.analyzeLandscape(
        "PNPLA3",
        "EFO_0001422",
        "Non-alcoholic fatty liver disease"
      ),
    ]);

  // Calculate scores
  console.log("1. Calculating scores...");
  const scores = targetScorer.calculateScores(
    association,
    tractability,
    safetySignals,
    competitorResult.landscape
  );

  console.log("Scores:");
  console.log("  Genetic evidence:", (scores.geneticEvidence * 100).toFixed(1) + "%");
  console.log("  Tractability:", (scores.tractability * 100).toFixed(1) + "%");
  console.log("  Safety risk:", (scores.safetyRisk * 100).toFixed(1) + "%");
  console.log("  Competitive:", (scores.competitiveLandscape * 100).toFixed(1) + "%");
  console.log("  COMPOSITE:", (scores.compositeScore * 100).toFixed(1) + "%");

  // Get interpretation
  console.log("\n2. Score interpretation...");
  const interpretation = targetScorer.interpretScore(scores);
  console.log("Overall rating:", interpretation.overall);
  console.log("Strengths:", interpretation.strengths);
  console.log("Weaknesses:", interpretation.weaknesses);

  // Determine verdict
  console.log("\n3. Determining verdict...");
  const decision = decisionEngine.determineVerdict(
    scores,
    safetySignals,
    competitorResult.landscape
  );
  console.log("Verdict:", decision.verdict);
  console.log("Recommendations:", decision.recommendations);
  if (decision.cautionFlags.length > 0) {
    console.log("Caution flags:", decision.cautionFlags);
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     OpenTargets Agent - API Client Test Suite              ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  try {
    await testOpenTargets();
    await testChEMBL();
    await testPubMed();
    await testClinicalTrials();
    await testTools();
    await testScoring();

    console.log("\n✅ All tests completed successfully!\n");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

main();
