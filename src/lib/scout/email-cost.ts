/** Perplexity Agent API cost per author email search with perplexity/sonar:
 *  web search $0.0025 each · sonar input/output ~$1/M tokens.
 *  A typical search runs ~3 web searches and ~11k input tokens; the worst case
 *  hits the 8-step cap (~8 searches, ~25k input tokens). Re-check against the
 *  Perplexity billing breakdown after a real batch. */
export const EMAIL_SEARCH_COST = { typical: 0.019, max: 0.046 };

export function emailSearchEstimate(authors: number) {
  const usd = (n: number) => (n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`);
  return {
    typical: usd(authors * EMAIL_SEARCH_COST.typical),
    max: usd(authors * EMAIL_SEARCH_COST.max),
  };
}
