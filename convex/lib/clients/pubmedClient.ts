/**
 * PubMed E-utilities Client
 * Handles literature searches via NCBI E-utilities API
 */

import { DEFAULT_CONFIG, SafetyEvidence, PubMedArticle } from "../types";

const PUBMED_BASE_URL = DEFAULT_CONFIG.pubmedApiUrl;

interface ESearchResult {
  esearchresult: {
    idlist: string[];
    count: string;
    retmax: string;
    retstart: string;
    querytranslation: string;
  };
}

interface EFetchResult {
  result: Record<
    string,
    {
      uid: string;
      pubdate: string;
      epubdate: string;
      source: string;
      authors: Array<{ name: string }>;
      title: string;
      sortfirstauthor: string;
      volume: string;
      issue: string;
      pages: string;
      elocationid: string;
      fulljournalname: string;
    }
  >;
}

// Helper function for HTTP requests
async function fetchPubMed<T>(
  endpoint: string,
  params: Record<string, string | number>
): Promise<T | null> {
  const url = new URL(`${PUBMED_BASE_URL}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  // Add API key if available
  const apiKey = process.env.NCBI_API_KEY;
  if (apiKey) {
    url.searchParams.set("api_key", apiKey);
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`PubMed request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`PubMed API error for ${endpoint}:`, error);
    return null;
  }
}

export const pubmedClient = {
  /**
   * Search PubMed for articles
   */
  async search(query: string, maxResults: number = 20): Promise<string[]> {
    const data = await fetchPubMed<ESearchResult>("esearch.fcgi", {
      db: "pubmed",
      term: query,
      retmax: maxResults,
      retmode: "json",
      sort: "relevance",
    });

    return data?.esearchresult?.idlist || [];
  },

  /**
   * Get article details by PMIDs
   */
  async getArticleDetails(pmids: string[]): Promise<PubMedArticle[]> {
    if (pmids.length === 0) return [];

    const data = await fetchPubMed<EFetchResult>("esummary.fcgi", {
      db: "pubmed",
      id: pmids.join(","),
      retmode: "json",
    });

    if (!data?.result) return [];

    const articles: PubMedArticle[] = [];

    for (const pmid of pmids) {
      const article = data.result[pmid];
      if (article && article.uid) {
        articles.push({
          pmid: article.uid,
          title: article.title,
          abstract: "", // Summary endpoint doesn't include abstract
          authors: article.authors?.map((a) => a.name) || [],
          journal: article.fulljournalname || article.source,
          pubDate: article.pubdate || article.epubdate,
          doi: article.elocationid?.replace("doi: ", ""),
        });
      }
    }

    return articles;
  },

  /**
   * Search for toxicity-related papers for a gene
   */
  async searchToxicityPapers(
    geneSymbol: string,
    toxicityType?: string,
    maxResults: number = 10
  ): Promise<SafetyEvidence[]> {
    // Build search query
    let query = `${geneSymbol}[Title/Abstract]`;

    if (toxicityType) {
      query += ` AND (${toxicityType}[Title/Abstract] OR toxicity[Title/Abstract])`;
    } else {
      query += " AND (toxicity[Title/Abstract] OR adverse[Title/Abstract] OR side effect[Title/Abstract])";
    }

    // Add filter for recent and human studies
    query += " AND (humans[MeSH] OR human[Title/Abstract])";

    const pmids = await pubmedClient.search(query, maxResults);
    if (pmids.length === 0) return [];

    const articles = await pubmedClient.getArticleDetails(pmids);

    return articles.map((article) => ({
      type: "PAPER" as const,
      source: "PubMed",
      description: `${article.title} (${article.authors[0] || "Unknown"} et al., ${article.journal}, ${article.pubDate})`,
      url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
      confidence: 0.7,
    }));
  },

  /**
   * Search for safety-related papers for a gene and organ system
   */
  async searchOrganToxicityPapers(
    geneSymbol: string,
    organSystem: string,
    maxResults: number = 5
  ): Promise<SafetyEvidence[]> {
    // Map organ systems to MeSH terms and keywords
    const organTerms: Record<string, string> = {
      liver: "hepatotoxicity OR liver toxicity OR hepatic injury",
      heart: "cardiotoxicity OR cardiac toxicity OR QT prolongation OR arrhythmia",
      kidney: "nephrotoxicity OR renal toxicity OR kidney injury",
      brain: "neurotoxicity OR CNS toxicity OR neurological adverse",
      lung: "pulmonary toxicity OR lung toxicity OR respiratory adverse",
    };

    const terms = organTerms[organSystem.toLowerCase()] || `${organSystem} toxicity`;

    const query = `${geneSymbol}[Title/Abstract] AND (${terms})`;

    const pmids = await pubmedClient.search(query, maxResults);
    if (pmids.length === 0) return [];

    const articles = await pubmedClient.getArticleDetails(pmids);

    return articles.map((article) => ({
      type: "PAPER" as const,
      source: "PubMed",
      description: `${article.title} (${article.authors[0] || "Unknown"} et al., ${article.journal})`,
      url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
      confidence: 0.7,
    }));
  },

  /**
   * Search for clinical safety papers
   */
  async searchClinicalSafetyPapers(
    geneSymbol: string,
    maxResults: number = 10
  ): Promise<SafetyEvidence[]> {
    const query = `${geneSymbol}[Title/Abstract] AND (clinical trial[Publication Type] OR clinical study[Title/Abstract]) AND (safety[Title/Abstract] OR adverse event[Title/Abstract] OR side effect[Title/Abstract])`;

    const pmids = await pubmedClient.search(query, maxResults);
    if (pmids.length === 0) return [];

    const articles = await pubmedClient.getArticleDetails(pmids);

    return articles.map((article) => ({
      type: "PAPER" as const,
      source: "PubMed",
      description: `Clinical safety: ${article.title} (${article.journal})`,
      url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
      confidence: 0.8,
    }));
  },

  /**
   * Search for animal model toxicity papers
   */
  async searchAnimalModelPapers(
    geneSymbol: string,
    maxResults: number = 5
  ): Promise<SafetyEvidence[]> {
    const query = `${geneSymbol}[Title/Abstract] AND (mouse[Title/Abstract] OR rat[Title/Abstract] OR animal model[Title/Abstract]) AND (toxicity[Title/Abstract] OR knockout[Title/Abstract] OR phenotype[Title/Abstract])`;

    const pmids = await pubmedClient.search(query, maxResults);
    if (pmids.length === 0) return [];

    const articles = await pubmedClient.getArticleDetails(pmids);

    return articles.map((article) => ({
      type: "ANIMAL_MODEL" as const,
      source: "PubMed",
      description: `Animal model: ${article.title}`,
      url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
      confidence: 0.6,
    }));
  },
};

export type PubMedClient = typeof pubmedClient;
