/** Perplexity Agent API cost per author email search, from the real billing
 *  for google/gemini-3.1-flash-lite (Oct 2026):
 *  web search $0.0025 each · input $0.25/M tokens · output $1.50/M tokens.
 *  A typical search runs ~2–3 web searches, ~11k input and ~450 output tokens;
 *  the worst case hits the 5-step cap (~5 searches, ~25k input tokens). */
export const EMAIL_SEARCH_COST = { typical: 0.0095, max: 0.021 };

export function emailSearchEstimate(authors: number) {
  const usd = (n: number) => (n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`);
  return {
    typical: usd(authors * EMAIL_SEARCH_COST.typical),
    max: usd(authors * EMAIL_SEARCH_COST.max),
  };
}
