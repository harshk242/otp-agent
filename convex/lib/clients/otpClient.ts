/**
 * OpenTargets Platform GraphQL Client
 * Handles all queries to the Open Targets Platform API
 */

import {
  TargetInfo,
  AssociationScore,
  Tractability,
  TractabilityModality,
  SafetySignal,
  SafetySeverity,
  KnownDrug,
  DEFAULT_CONFIG,
} from "../types";
import { getGenePageUrlBySymbol } from "./clinpgxClient";

// GraphQL Queries
const TARGET_INFO_QUERY = `
  query TargetInfo($ensemblId: String!) {
    target(ensemblId: $ensemblId) {
      id
      approvedSymbol
      approvedName
      biotype
      functionDescriptions
      genomicLocation {
        chromosome
        start
        end
      }
      symbolSynonyms {
        label
      }
    }
  }
`;

const SEARCH_TARGET_QUERY = `
  query SearchTarget($queryString: String!, $entityNames: [String!]) {
    search(queryString: $queryString, entityNames: $entityNames, page: { index: 0, size: 10 }) {
      hits {
        id
        entity
        name
        description
      }
    }
  }
`;

const ASSOCIATION_SCORE_QUERY = `
  query AssociationScore($ensemblId: String!) {
    target(ensemblId: $ensemblId) {
      id
      associatedDiseases(page: { index: 0, size: 1000 }) {
        rows {
          disease {
            id
            name
          }
          score
          datatypeScores {
            id
            score
          }
        }
      }
    }
  }
`;

const DISEASE_ASSOCIATION_QUERY = `
  query DiseaseAssociation($efoId: String!, $ensemblIds: [String!]!) {
    disease(efoId: $efoId) {
      id
      name
      associatedTargets(
        Bs: $ensemblIds
        page: { index: 0, size: 100 }
      ) {
        rows {
          target {
            id
            approvedSymbol
          }
          score
          datatypeScores {
            id
            score
          }
        }
      }
    }
  }
`;

const TRACTABILITY_QUERY = `
  query Tractability($ensemblId: String!) {
    target(ensemblId: $ensemblId) {
      id
      tractability {
        modality
        value
        label
      }
    }
  }
`;

const SAFETY_LIABILITIES_QUERY = `
  query SafetyLiabilities($ensemblId: String!) {
    target(ensemblId: $ensemblId) {
      id
      approvedSymbol
      safetyLiabilities {
        event
        eventId
        effects {
          direction
          dosing
        }
        biosamples {
          cellLabel
          tissueLabel
        }
        datasource
        literature
        url
      }
    }
  }
`;

const KNOWN_DRUGS_QUERY = `
  query KnownDrugs($ensemblId: String!) {
    target(ensemblId: $ensemblId) {
      id
      knownDrugs {
        count
        rows {
          drugId
          drug {
            id
            name
            maximumClinicalTrialPhase
            isApproved
          }
          phase
          status
          mechanismOfAction
        }
      }
    }
  }
`;

const SEARCH_DISEASE_QUERY = `
  query SearchDisease($queryString: String!) {
    search(queryString: $queryString, entityNames: ["disease"], page: { index: 0, size: 10 }) {
      hits {
        id
        entity
        name
        description
      }
    }
  }
`;

const DISEASE_INFO_QUERY = `
  query DiseaseInfo($efoId: String!) {
    disease(efoId: $efoId) {
      id
      name
      description
      synonyms {
        terms
      }
      therapeuticAreas {
        id
        name
      }
    }
  }
`;

// Helper function for HTTP requests
async function fetchGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
  apiUrl: string = DEFAULT_CONFIG.otpApiUrl
): Promise<T> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors && result.errors.length > 0) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data as T;
}

// OpenTargets Platform Client
export const otpClient = {
  /**
   * Get target information by Ensembl ID
   */
  async getTargetInfo(ensemblId: string): Promise<TargetInfo | null> {
    const data = await fetchGraphQL<{
      target: {
        id: string;
        approvedSymbol: string;
        approvedName: string;
        biotype: string;
        functionDescriptions: string[];
        genomicLocation?: {
          chromosome: string;
          start: number;
          end: number;
        };
        symbolSynonyms?: { label: string }[];
      } | null;
    }>(TARGET_INFO_QUERY, { ensemblId });

    if (!data.target) return null;

    const t = data.target;
    return {
      ensemblId: t.id,
      symbol: t.approvedSymbol,
      name: t.approvedName,
      biotype: t.biotype,
      description: t.functionDescriptions?.[0],
      chromosome: t.genomicLocation?.chromosome,
      start: t.genomicLocation?.start,
      end: t.genomicLocation?.end,
      synonyms: t.symbolSynonyms?.map((s) => s.label),
    };
  },

  /**
   * Search for a target by gene symbol
   */
  async searchTarget(
    geneSymbol: string
  ): Promise<{ id: string; name: string; description: string } | null> {
    const data = await fetchGraphQL<{
      search: {
        hits: Array<{
          id: string;
          entity: string;
          name: string;
          description: string;
        }>;
      };
    }>(SEARCH_TARGET_QUERY, {
      queryString: geneSymbol,
      entityNames: ["target"],
    });

    const hit = data.search.hits.find(
      (h) => h.entity === "target" && h.name.toUpperCase() === geneSymbol.toUpperCase()
    );

    if (!hit) {
      // Try partial match
      const partialHit = data.search.hits.find((h) => h.entity === "target");
      return partialHit || null;
    }

    return hit;
  },

  /**
   * Get association score between target and disease
   */
  async getAssociationScore(
    ensemblId: string,
    diseaseId: string
  ): Promise<AssociationScore | null> {
    const data = await fetchGraphQL<{
      target: {
        id: string;
        associatedDiseases: {
          rows: Array<{
            disease: { id: string; name: string };
            score: number;
            datatypeScores: Array<{ id: string; score: number }>;
          }>;
        };
      } | null;
    }>(ASSOCIATION_SCORE_QUERY, { ensemblId });

    if (!data.target) return null;

    // Find the specific disease association
    const association = data.target.associatedDiseases.rows.find(
      (r) => r.disease.id === diseaseId
    );

    if (!association) {
      // Return zero scores if no association found
      return {
        overallScore: 0,
        geneticAssociation: 0,
        somaticMutation: 0,
        knownDrug: 0,
        affectedPathway: 0,
        literature: 0,
        rnaExpression: 0,
        animalModel: 0,
      };
    }

    // Map datatype scores
    const datatypeMap = new Map(
      association.datatypeScores.map((d) => [d.id, d.score])
    );

    return {
      overallScore: association.score,
      geneticAssociation: datatypeMap.get("genetic_association") || 0,
      somaticMutation: datatypeMap.get("somatic_mutation") || 0,
      knownDrug: datatypeMap.get("known_drug") || 0,
      affectedPathway: datatypeMap.get("affected_pathway") || 0,
      literature: datatypeMap.get("literature") || 0,
      rnaExpression: datatypeMap.get("rna_expression") || 0,
      animalModel: datatypeMap.get("animal_model") || 0,
    };
  },

  /**
   * Get tractability assessment for target
   */
  async getTractability(ensemblId: string): Promise<Tractability | null> {
    const data = await fetchGraphQL<{
      target: {
        id: string;
        tractability: Array<{
          modality: string;
          value: boolean;
          label: string;
        }>;
      } | null;
    }>(TRACTABILITY_QUERY, { ensemblId });

    if (!data.target) return null;

    const tractData = data.target.tractability;

    // Group by modality
    const modalityGroups = new Map<string, Array<{ label: string; value: boolean }>>();
    for (const t of tractData) {
      const group = modalityGroups.get(t.modality) || [];
      group.push({ label: t.label, value: t.value });
      modalityGroups.set(t.modality, group);
    }

    const createModality = (
      modalityName: string
    ): TractabilityModality | undefined => {
      const items = modalityGroups.get(modalityName);
      if (!items) return undefined;

      const assessedItems = items.filter((i) => i.value);
      return {
        modality: modalityName,
        isAssessed: assessedItems.length > 0,
        topCategory: assessedItems[0]?.label,
        buckets: assessedItems.map((i) => i.label),
      };
    };

    return {
      smallMolecule: createModality("SM"),
      antibody: createModality("AB"),
      protac: createModality("PR"),
      otherModalities: Array.from(modalityGroups.keys())
        .filter((k) => !["SM", "AB", "PR"].includes(k))
        .map((k) => createModality(k)!)
        .filter(Boolean),
    };
  },

  /**
   * Get safety liabilities for target
   */
  async getSafetyLiabilities(ensemblId: string): Promise<SafetySignal[]> {
    const data = await fetchGraphQL<{
      target: {
        id: string;
        approvedSymbol: string;
        safetyLiabilities: Array<{
          event: string;
          eventId: string;
          effects: Array<{ direction: string; dosing: string }>;
          biosamples: Array<{ cellLabel: string; tissueLabel: string }>;
          datasource: string;
          literature: string;
          url: string;
        }>;
      } | null;
    }>(SAFETY_LIABILITIES_QUERY, { ensemblId });

    if (!data.target) return [];

    // Get ClinPGx URL for this gene (only called once per gene)
    const geneSymbol = data.target.approvedSymbol;
    const clinpgxUrl = geneSymbol
      ? await getGenePageUrlBySymbol(geneSymbol)
      : null;

    return data.target.safetyLiabilities.map((s) => {
      // Determine severity based on event type and effects
      let severity: SafetySeverity = "MODERATE";
      const eventLower = s.event.toLowerCase();

      if (
        eventLower.includes("death") ||
        eventLower.includes("fatal") ||
        eventLower.includes("life-threatening")
      ) {
        severity = "CRITICAL";
      } else if (
        eventLower.includes("severe") ||
        eventLower.includes("serious") ||
        eventLower.includes("hepatotox") ||
        eventLower.includes("cardiotox") ||
        eventLower.includes("nephrotox")
      ) {
        severity = "HIGH";
      } else if (
        eventLower.includes("mild") ||
        eventLower.includes("minor")
      ) {
        severity = "LOW";
      }

      // Extract organ system from biosamples
      const organSystems = s.biosamples
        .map((b) => b.tissueLabel)
        .filter(Boolean);
      const organSystem = organSystems[0];

      // Use ClinPGx URL if datasource is ClinPGx and we have a valid URL
      const evidenceUrl =
        s.datasource === "ClinPGx" && clinpgxUrl ? clinpgxUrl : s.url || undefined;

      return {
        signalType: "target_safety",
        organSystem,
        severity,
        description: s.event,
        evidence: [
          {
            type: "REGULATORY" as const,
            source: s.datasource,
            description: `${s.event} - ${s.effects.map((e) => `${e.direction} ${e.dosing}`).join(", ")}`,
            url: evidenceUrl,
          },
        ],
      };
    });
  },

  /**
   * Get known drugs targeting this gene
   */
  async getKnownDrugs(ensemblId: string): Promise<KnownDrug[]> {
    const data = await fetchGraphQL<{
      target: {
        id: string;
        knownDrugs: {
          count: number;
          rows: Array<{
            drugId: string;
            drug: {
              id: string;
              name: string;
              maximumClinicalTrialPhase: number;
              isApproved: boolean;
            };
            phase: number;
            status: string;
            mechanismOfAction: string;
          }>;
        };
      } | null;
    }>(KNOWN_DRUGS_QUERY, { ensemblId });

    if (!data.target || !data.target.knownDrugs) return [];

    return data.target.knownDrugs.rows.map((d) => ({
      drugId: d.drug.id,
      drugName: d.drug.name,
      phase: d.phase ? `Phase ${d.phase}` : (d.drug.isApproved ? "Approved" : "Unknown"),
      status: d.status || (d.drug.isApproved ? "Approved" : undefined),
      mechanismOfAction: d.mechanismOfAction,
    }));
  },

  /**
   * Search for a disease
   */
  async searchDisease(
    query: string
  ): Promise<{ id: string; name: string; description: string } | null> {
    const data = await fetchGraphQL<{
      search: {
        hits: Array<{
          id: string;
          entity: string;
          name: string;
          description: string;
        }>;
      };
    }>(SEARCH_DISEASE_QUERY, { queryString: query });

    const hit = data.search.hits.find((h) => h.entity === "disease");
    return hit || null;
  },

  /**
   * Search for multiple diseases (returns all disease hits)
   */
  async searchDiseases(
    query: string
  ): Promise<Array<{ id: string; name: string; description: string }>> {
    const data = await fetchGraphQL<{
      search: {
        hits: Array<{
          id: string;
          entity: string;
          name: string;
          description: string;
        }>;
      };
    }>(SEARCH_DISEASE_QUERY, { queryString: query });

    // Filter and return all disease hits
    return data.search.hits
      .filter((h) => h.entity === "disease")
      .map((h) => ({
        id: h.id,
        name: h.name,
        description: h.description,
      }));
  },

  /**
   * Get disease information
   */
  async getDiseaseInfo(
    diseaseId: string
  ): Promise<{ id: string; name: string; description: string } | null> {
    const data = await fetchGraphQL<{
      disease: {
        id: string;
        name: string;
        description: string;
        synonyms: { terms: string[] };
        therapeuticAreas: Array<{ id: string; name: string }>;
      } | null;
    }>(DISEASE_INFO_QUERY, { efoId: diseaseId });

    if (!data.disease) return null;

    return {
      id: data.disease.id,
      name: data.disease.name,
      description: data.disease.description,
    };
  },

  /**
   * Get multiple target associations for a disease (batch query)
   */
  async getDiseaseTargetAssociations(
    diseaseId: string,
    ensemblIds: string[]
  ): Promise<Map<string, AssociationScore>> {
    const data = await fetchGraphQL<{
      disease: {
        id: string;
        name: string;
        associatedTargets: {
          rows: Array<{
            target: { id: string; approvedSymbol: string };
            score: number;
            datatypeScores: Array<{ id: string; score: number }>;
          }>;
        };
      } | null;
    }>(DISEASE_ASSOCIATION_QUERY, { efoId: diseaseId, ensemblIds });

    const result = new Map<string, AssociationScore>();

    if (!data.disease) return result;

    for (const row of data.disease.associatedTargets.rows) {
      const datatypeMap = new Map(
        row.datatypeScores.map((d) => [d.id, d.score])
      );

      result.set(row.target.id, {
        overallScore: row.score,
        geneticAssociation: datatypeMap.get("genetic_association") || 0,
        somaticMutation: datatypeMap.get("somatic_mutation") || 0,
        knownDrug: datatypeMap.get("known_drug") || 0,
        affectedPathway: datatypeMap.get("affected_pathway") || 0,
        literature: datatypeMap.get("literature") || 0,
        rnaExpression: datatypeMap.get("rna_expression") || 0,
        animalModel: datatypeMap.get("animal_model") || 0,
      });
    }

    return result;
  },
};

export type OTPClient = typeof otpClient;
