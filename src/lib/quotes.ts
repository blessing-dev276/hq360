// Price quotes shared by the editor, the public /quote page and exports.

export const QUOTE_CURRENCIES = ["USD", "NGN", "GBP", "EUR"] as const;
export type QuoteCurrency = (typeof QUOTE_CURRENCIES)[number];

export type QuotePackage = {
  name: string;
  /** Major units (e.g. 650 = $650). */
  price: number;
  /** Optional "was" price shown slashed; only used when higher than `price`. */
  original_price?: number | null;
  delivery: string;
  features: string[];
  recommended: boolean;
};

export type Quote = {
  id?: string;
  token?: string;
  prepared_by: string;
  client_name: string;
  project_title: string;
  intro: string;
  currency: QuoteCurrency;
  packages: QuotePackage[];
  notes: string;
  valid_until: string | null;
  views?: number;
  created_at?: string;
  updated_at?: string;
};

export const MAX_PACKAGES = 4;

export function formatPrice(amount: number, currency: QuoteCurrency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount || 0);
}

/** Percent saved when a slashed "was" price is set, else null. */
export function discountPercent(pkg: Pick<QuotePackage, "price" | "original_price">) {
  const was = pkg.original_price ?? 0;
  if (!was || was <= pkg.price) return null;
  return Math.round(((was - pkg.price) / was) * 100);
}

export function longDate(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
}

export function quoteReference(quote: Pick<Quote, "token" | "id">) {
  const key = (quote.token || quote.id || "").replace(/-/g, "");
  return key ? `Q-${key.slice(0, 6).toUpperCase()}` : "Draft";
}

const inDays = (days: number) => new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);

export const blankPackage = (name = "Package"): QuotePackage => ({
  name,
  price: 0,
  delivery: "",
  features: [""],
  recommended: false,
});

/** Starting points so experts rarely start from an empty page. */
export const QUOTE_TEMPLATES: { key: string; label: string; packages: () => QuotePackage[] }[] = [
  {
    key: "single",
    label: "One package",
    packages: () => [{ ...blankPackage("Full project"), recommended: true }],
  },
  {
    key: "tiers",
    label: "3 tiers",
    packages: () => [
      { ...blankPackage("Starter"), delivery: "1 week" },
      { ...blankPackage("Standard"), delivery: "2 weeks", recommended: true },
      { ...blankPackage("Premium"), delivery: "3 weeks" },
    ],
  },
  {
    key: "two",
    label: "2 options",
    packages: () => [
      { ...blankPackage("Essential"), delivery: "1 week" },
      { ...blankPackage("Complete"), delivery: "2 weeks", recommended: true },
    ],
  },
];

export function newQuote(preparedBy: string): Quote {
  return {
    prepared_by: preparedBy,
    client_name: "",
    project_title: "",
    intro:
      "Thank you for considering HQ360. Below are the options we recommend for your project. Choose the one that fits best and we'll get started.",
    currency: "USD",
    packages: QUOTE_TEMPLATES[1]!.packages(),
    notes: "50% to start, 50% on delivery. Prices include up to two rounds of revisions.",
    valid_until: inDays(30),
  };
}
