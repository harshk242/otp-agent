/**
 * ClinPGx API Client
 * Handles queries to the ClinPGx (PharmGKB) API
 */

const CLINPGX_API_BASE = "https://api.clinpgx.org/v1";

interface ClinPGxGeneResponse {
  data: Array<{
    id: string;
    symbol: string;
    name: string;
  }>;
  status: string;
}

/**
 * Get ClinPGx gene ID by gene symbol
 * @param symbol - HGNC gene symbol (e.g., "ESR1")
 * @returns ClinPGx gene ID (e.g., "PA156") or null if not found
 */
export async function getGeneIdBySymbol(
  symbol: string
): Promise<string | null> {
  if (!symbol) return null;

  try {
    const url = `${CLINPGX_API_BASE}/data/gene?symbol=${encodeURIComponent(symbol)}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(
        `ClinPGx API request failed: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const result: ClinPGxGeneResponse = await response.json();

    if (result.status === "success" && result.data && result.data.length > 0) {
      return result.data[0].id;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching ClinPGx gene ID for ${symbol}:`, error);
    return null;
  }
}

/**
 * Build ClinPGx gene page URL
 * @param geneId - ClinPGx gene ID (e.g., "PA156")
 * @returns URL to ClinPGx gene page
 */
export function buildGenePageUrl(geneId: string): string {
  return `https://www.clinpgx.org/gene/${geneId}`;
}

/**
 * Get ClinPGx gene page URL by gene symbol
 * @param symbol - HGNC gene symbol (e.g., "ESR1")
 * @returns URL to ClinPGx gene page or null if gene not found
 */
export async function getGenePageUrlBySymbol(
  symbol: string
): Promise<string | null> {
  const geneId = await getGeneIdBySymbol(symbol);
  return geneId ? buildGenePageUrl(geneId) : null;
}
