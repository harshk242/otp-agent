/**
 * PubMed E-utilities Client
 * Handles literature searches via NCBI E-utilities API
 */

import { DEFAULT_CONFIG, SafetyEvidence, PubMedArticle } from "../types";

const PUBMED_BASE_URL = DEFAULT_CONFIG.pubmedApiUrl;

// Rate limiting configuration
// PubMed allows 3 req/sec without API key, 10 req/sec with API key
const RATE_LIMIT_DELAY_MS = 100; // ~10 requests per second with API key
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

// Simple rate limiter using a queue
let lastRequestTime = 0;
const requestQueue: Array<() => void> = [];
let isProcessingQueue = false;

async function waitForRateLimit(): Promise<void> {
  return new Promise((resolve) => {
    requestQueue.push(resolve);
    processQueue();
  });
}

function processQueue(): void {
  if (isProcessingQueue || requestQueue.length === 0) return;

  isProcessingQueue = true;

  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  const delay = Math.max(0, RATE_LIMIT_DELAY_MS - timeSinceLastRequest);

  setTimeout(() => {
    lastRequestTime = Date.now();
    const resolve = requestQueue.shift();
    isProcessingQueue = false;

    if (resolve) {
      resolve();
    }

    // Process next item in queue
    if (requestQueue.length > 0) {
      processQueue();
    }
  }, delay);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

// Helper function for HTTP requests with rate limiting and retry
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

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Wait for rate limit slot
    await waitForRateLimit();

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status === 429) {
        // Rate limited - exponential backoff
        const retryDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `PubMed rate limited (attempt ${attempt + 1}/${MAX_RETRIES}), waiting ${retryDelay}ms...`
        );
        await sleep(retryDelay);
        continue;
      }

      if (!response.ok) {
        throw new Error(`PubMed request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error as Error;
      if (attempt < MAX_RETRIES - 1) {
        const retryDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `PubMed request error (attempt ${attempt + 1}/${MAX_RETRIES}): ${lastError.message}, retrying in ${retryDelay}ms...`
        );
        await sleep(retryDelay);
      }
    }
  }

  console.error(`PubMed API error for ${endpoint} after ${MAX_RETRIES} retries:`, lastError);
  return null;
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
