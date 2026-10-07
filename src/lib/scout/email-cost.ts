/** Planning estimates, not a price quote or enforced spend limit. Luna's
 * standard token rates are $0.10/M input and $0.50/M output. Tool charges
 * are separate and depend on actual calls. Three adaptive four-step passes
 * can cost more than a single pass. Validate against provider billing.
 */
export const EMAIL_SEARCH_COST = { typical: 0.015, max: 0.06 };

export function emailSearchEstimate(authors: number) {
  const usd = (n: number) => (n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`);
  return {
    typical: usd(authors * EMAIL_SEARCH_COST.typical),
    max: usd(authors * EMAIL_SEARCH_COST.max),
  };
}
