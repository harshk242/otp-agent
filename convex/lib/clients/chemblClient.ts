/**
 * ChEMBL REST API Client
 * Handles queries to ChEMBL for compound and toxicity data
 */

import { DEFAULT_CONFIG, SafetyEvidence } from "../types";

const CHEMBL_API_URL = DEFAULT_CONFIG.chemblApiUrl;

interface ChEMBLTarget {
  target_chembl_id: string;
  pref_name: string;
  target_type: string;
  organism: string;
}

interface ChEMBLMechanism {
  mechanism_of_action: string;
  target_chembl_id: string;
  molecule_chembl_id: string;
  action_type: string;
}

interface ChEMBLMolecule {
  molecule_chembl_id: string;
  pref_name: string;
  max_phase: number;
  withdrawn_flag: boolean;
  withdrawn_reason: string | null;
  molecule_type: string;
}

interface ChEMBLActivity {
  activity_id: number;
  assay_chembl_id: string;
  molecule_chembl_id: string;
  target_chembl_id: string;
  standard_type: string;
  standard_value: number;
  standard_units: string;
  pchembl_value: number | null;
}

// Helper function for HTTP requests
async function fetchChEMBL<T>(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T | null> {
  const url = new URL(`${CHEMBL_API_URL}${endpoint}.json`);
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
      if (response.status === 404) {
        return null;
      }
      throw new Error(`ChEMBL request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`ChEMBL API error for ${endpoint}:`, error);
    return null;
  }
}

export const chemblClient = {
  /**
   * Search for ChEMBL target by gene symbol
   */
  async searchTargetByGene(
    geneSymbol: string
  ): Promise<{ targetChemblId: string; name: string } | null> {
    const data = await fetchChEMBL<{ targets: ChEMBLTarget[] }>("/target/search", {
      q: geneSymbol,
      limit: 10,
    });

    if (!data?.targets?.length) return null;

    // Find the best match (human target with matching name)
    const humanTarget = data.targets.find(
      (t) =>
        t.organism === "Homo sapiens" &&
        (t.pref_name?.toUpperCase().includes(geneSymbol.toUpperCase()) ||
          t.target_type === "SINGLE PROTEIN")
    );

    const target = humanTarget || data.targets[0];

    return {
      targetChemblId: target.target_chembl_id,
      name: target.pref_name,
    };
  },

  /**
   * Get mechanisms of action for a ChEMBL target
   */
  async getMechanismsForTarget(
    targetChemblId: string
  ): Promise<Array<{ molecule: string; mechanism: string; actionType: string }>> {
    const data = await fetchChEMBL<{ mechanisms: ChEMBLMechanism[] }>(
      `/mechanism`,
      {
        target_chembl_id: targetChemblId,
        limit: 100,
      }
    );

    if (!data?.mechanisms?.length) return [];

    return data.mechanisms.map((m) => ({
      molecule: m.molecule_chembl_id,
      mechanism: m.mechanism_of_action,
      actionType: m.action_type,
    }));
  },

  /**
   * Get bioactivities for a target
   */
  async getActivitiesForTarget(
    targetChemblId: string,
    limit: number = 50
  ): Promise<
    Array<{
      moleculeId: string;
      assayId: string;
      type: string;
      value: number;
      units: string;
    }>
  > {
    const data = await fetchChEMBL<{ activities: ChEMBLActivity[] }>(
      `/activity`,
      {
        target_chembl_id: targetChemblId,
        limit,
      }
    );

    if (!data?.activities?.length) return [];

    return data.activities.map((a) => ({
      moleculeId: a.molecule_chembl_id,
      assayId: a.assay_chembl_id,
      type: a.standard_type,
      value: a.standard_value,
      units: a.standard_units,
    }));
  },

  /**
   * Search for compounds with toxicity data
   */
  async searchCompoundsWithToxicity(
    geneSymbol: string,
    toxicityType: string
  ): Promise<SafetyEvidence[]> {
    // First, find the target
    const target = await chemblClient.searchTargetByGene(geneSymbol);
    if (!target) return [];

    // Get mechanisms for this target (which includes drug info)
    const mechanisms = await chemblClient.getMechanismsForTarget(
      target.targetChemblId
    );

    const evidence: SafetyEvidence[] = [];

    // Get details for each molecule
    for (const mech of mechanisms.slice(0, 20)) {
      // Limit to first 20
      const moleculeData = await fetchChEMBL<{ molecules: ChEMBLMolecule[] }>(
        `/molecule`,
        {
          molecule_chembl_id: mech.molecule,
        }
      );

      if (moleculeData?.molecules?.[0]) {
        const mol = moleculeData.molecules[0];

        // Check if this molecule has relevant toxicity info
        if (mol.withdrawn_flag && mol.withdrawn_reason) {
          const reasonLower = mol.withdrawn_reason.toLowerCase();
          const toxicityLower = toxicityType.toLowerCase();

          // Check if withdrawal reason matches toxicity type
          if (
            reasonLower.includes(toxicityLower) ||
            reasonLower.includes("hepat") ||
            reasonLower.includes("cardio") ||
            reasonLower.includes("toxic")
          ) {
            evidence.push({
              type: "COMPOUND",
              source: "ChEMBL",
              description: `${mol.pref_name || mol.molecule_chembl_id}: Withdrawn - ${mol.withdrawn_reason}`,
              url: `https://www.ebi.ac.uk/chembl/compound_report_card/${mol.molecule_chembl_id}/`,
              confidence: 0.9,
            });
          }
        }
      }
    }

    return evidence;
  },

  /**
   * Get withdrawn drugs for a target
   */
  async getWithdrawnDrugsForTarget(geneSymbol: string): Promise<
    Array<{
      drugName: string;
      chemblId: string;
      withdrawnReason: string;
      maxPhase: number;
    }>
  > {
    // First, find the target
    const target = await chemblClient.searchTargetByGene(geneSymbol);
    if (!target) return [];

    // Get mechanisms for this target
    const mechanisms = await chemblClient.getMechanismsForTarget(
      target.targetChemblId
    );

    const withdrawnDrugs: Array<{
      drugName: string;
      chemblId: string;
      withdrawnReason: string;
      maxPhase: number;
    }> = [];

    // Check each molecule for withdrawn status
    for (const mech of mechanisms.slice(0, 30)) {
      const moleculeData = await fetchChEMBL<{ molecules: ChEMBLMolecule[] }>(
        `/molecule`,
        {
          molecule_chembl_id: mech.molecule,
        }
      );

      if (moleculeData?.molecules?.[0]) {
        const mol = moleculeData.molecules[0];

        if (mol.withdrawn_flag) {
          withdrawnDrugs.push({
            drugName: mol.pref_name || mol.molecule_chembl_id,
            chemblId: mol.molecule_chembl_id,
            withdrawnReason: mol.withdrawn_reason || "Unknown reason",
            maxPhase: mol.max_phase,
          });
        }
      }
    }

    return withdrawnDrugs;
  },

  /**
   * Search for compounds with specific adverse effects
   */
  async searchAdverseEffects(
    geneSymbol: string,
    organSystem: string
  ): Promise<SafetyEvidence[]> {
    // Map organ systems to search terms
    const searchTerms: Record<string, string[]> = {
      liver: ["hepatotoxicity", "liver toxicity", "hepatic", "ALT", "AST"],
      heart: ["cardiotoxicity", "cardiac", "QT prolongation", "arrhythmia"],
      kidney: ["nephrotoxicity", "renal", "kidney"],
      brain: ["neurotoxicity", "CNS", "neurological"],
      lung: ["pulmonary toxicity", "respiratory", "lung"],
    };

    const terms = searchTerms[organSystem.toLowerCase()] || [organSystem];
    const evidence: SafetyEvidence[] = [];

    // Search for each term
    for (const term of terms) {
      const results = await chemblClient.searchCompoundsWithToxicity(
        geneSymbol,
        term
      );
      evidence.push(...results);
    }

    // Deduplicate by source
    const seen = new Set<string>();
    return evidence.filter((e) => {
      if (seen.has(e.source + e.description)) return false;
      seen.add(e.source + e.description);
      return true;
    });
  },
};

export type ChEMBLClient = typeof chemblClient;
