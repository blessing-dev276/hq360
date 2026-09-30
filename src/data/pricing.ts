/** Public starting prices (USD). Edit here; the homepage, /pricing and /services all read this. */
export type Plan = {
  name: string;
  price: string;
  cadence: string;
  note: string;
  items: string[];
  tag?: string;
  featured?: boolean;
};

export const PLANS: Plan[] = [
  {
    name: "Starter",
    price: "$299",
    cadence: "one-time",
    note: "A clean, professional start online.",
    items: [
      "Up to 5-page mobile-friendly website",
      "Contact form connected to your email",
      "Basic SEO set-up and 2 revision rounds",
    ],
  },
  {
    name: "Growth",
    price: "$799",
    cadence: "one-time",
    tag: "Best value",
    note: "For businesses ready to connect the pieces.",
    items: [
      "Up to 10-page website or sales funnel",
      "CRM set-up with automated follow-ups",
      "30 days of support after launch",
    ],
    featured: true,
  },
  {
    name: "Author",
    price: "$249",
    cadence: "one-time",
    note: "For authors and publishers.",
    items: [
      "Author website with a book page",
      "Retailer links and newsletter sign-up",
      "Free author visibility check included",
    ],
  },
];

export const CARE_PLAN = { price: "$49", cadence: "/month" };

export const PRICING_NOTES = [
  "Mobile apps, writing, translation and larger builds are quoted after a short brief.",
  "Prices are starting points in USD. You’ll get a written scope before any work begins.",
];
