/** Perplexity Agent API cost per author with google/gemini-3.1-flash-lite and
 *  the deep 3-pass search (up to 20 steps): web search $0.0025 each, input
 *  $0.25/M, output $1.50/M tokens, ~4.5k input tokens per search. Most authors
 *  stop after pass 1 (~6 searches); one with no public email uses all ~20. */
export const EMAIL_SEARCH_COST = { typical: 0.035, max: 0.076 };

export function emailSearchEstimate(authors: number) {
  const usd = (n: number) => (n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`);
  return {
    typical: usd(authors * EMAIL_SEARCH_COST.typical),
    max: usd(authors * EMAIL_SEARCH_COST.max),
  };
}
