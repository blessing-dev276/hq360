import type { ItemBlocks, ItemStatus } from "./core";

// Hugh Murphy's tracker, recreated from hugh-progress.pages.dev (spec section 7).
// The passcode is deliberately NOT here: the seed script reads it from the
// HUGH_PASSCODE environment variable and stores only its bcrypt hash.

export const HUGH_TRACKER = {
  clientName: "Hugh Murphy",
  projectTitle: "Memories And Observations",
  packageName: "Premium package",
  slugSuffix: "7k2q", // hq360.space/track/hugh-murphy-7k2q
  expertName: "Emmanuel Sunday",
};

export const GOODREADS_LISTS = [
  ["Northern Ireland", "#1 on page one"],
  ["Books about the Northern Irish Troubles", ""],
  ["The Troubles and Post Agreement Northern Ireland", ""],
  ["Books Set in Ireland", ""],
  ["Best Irish Books", ""],
  ["Best Books About Corruption", ""],
  ["Corruption, Plutocracy, Oligarchy, Kleptocracy (nonfiction)", ""],
  ["Best Of Investigative Journalism, Nonfiction", ""],
  ["Independent Memoirs", ""],
  ["Indie Memoirs and Autobiographies, Nonfiction", ""],
] as const;

export type SeedItem = {
  key: string;
  title: string;
  status: ItemStatus;
  progress: number;
  description: string;
  is_free_bonus: boolean;
  blocks: ItemBlocks;
  /** Files from hugh-tracker-site.zip that belong to this item. */
  files: { name: string; contentType: string; highlight?: true }[];
};

export const HUGH_ITEMS: SeedItem[] = [
  {
    key: "website",
    title: "Premium personal author website",
    status: "progress",
    progress: 65,
    description: "Your website is being built and is already viewable as a private preview.",
    is_free_bonus: false,
    blocks: {},
    files: [],
  },
  {
    key: "domain",
    title: "Domain and hosting setup",
    status: "next",
    progress: 0,
    description: "Your website address and secure hosting will be set up as part of the launch.",
    is_free_bonus: false,
    blocks: {},
    files: [],
  },
  {
    key: "goodreads",
    title: "Page 1 ranking on 10 Goodreads lists",
    status: "progress",
    progress: 10,
    description:
      "Memories And Observations is being added to the ten Goodreads Listopia lists below, and we are working to move it onto page one of each. The first list is complete, and this page shows every list and its position as we go.",
    is_free_bonus: false,
    blocks: {
      lists: GOODREADS_LISTS.map(([name, position]) => ({ name, link: "", position })),
      highlight: { text: "First result: number 1 on the Northern Ireland list" },
    },
    files: [{ name: "goodreads-ni-r1.jpg", contentType: "image/jpeg", highlight: true }],
  },
  {
    key: "report",
    title: "Monthly ranking report and tracking for 3 months",
    status: "next",
    progress: 0,
    description:
      "Once the lists are under way, you will receive a report each month showing where your book sits on every list.",
    is_free_bonus: false,
    blocks: {},
    files: [],
  },
  {
    key: "graphics",
    title: "Social media graphics using quotes from the book",
    status: "progress",
    progress: 50,
    description:
      "Shareable graphics for Facebook, Instagram and X, built around powerful lines from your book. The first four are ready for your approval, made from your book's subtitle and description. Once we receive your manuscript, we will add graphics using lines from inside the chapters.",
    is_free_bonus: false,
    blocks: {},
    files: [1, 2, 3, 4].map((n) => ({ name: `gfx-${n}-q7.png`, contentType: "image/png" })),
  },
  {
    key: "presskit",
    title: "Press kit",
    status: "done",
    progress: 100,
    description:
      "A two page press kit ready to send to newspapers, radio, podcasts, bookshops and event organisers.",
    is_free_bonus: true,
    blocks: {},
    files: [{ name: "press-kit-k4p8.pdf", contentType: "application/pdf" }],
  },
  {
    key: "teaser",
    title: "Suspense teaser: The File",
    status: "done",
    progress: 100,
    description:
      "A 45 second suspense teaser built like a secret case file, with an original soundtrack and your original cover at the end.",
    is_free_bonus: true,
    blocks: {},
    files: [{ name: "teaser-r3v8n1.mp4", contentType: "video/mp4" }],
  },
  {
    key: "trailer",
    title: "Book trailer",
    status: "done",
    progress: 100,
    description:
      "A 62 second cinematic trailer with an original soundtrack, ending on your original cover. Included free with your package.",
    is_free_bonus: true,
    blocks: {},
    files: [{ name: "trailer-m7q2x9.mp4", contentType: "video/mp4" }],
  },
];

/** Newest first, exactly as on today's page. */
export const HUGH_LOG: { date: string; text: string }[] = [
  { date: "2026-10-20", text: "Four social media graphics designed and ready for your approval." },
  {
    date: "2026-10-20",
    text: "Goodreads: Memories And Observations reached number 1 on the Northern Ireland list, the first of your ten lists.",
  },
  { date: "2026-10-15", text: "Your author photo added to the press kit." },
  { date: "2026-10-15", text: 'Suspense teaser "The File" completed and added to your package as a free bonus.' },
  { date: "2026-10-15", text: "Press kit completed and added to your package as a free bonus." },
  {
    date: "2026-10-15",
    text: "Website and book trailer updated to use your original Spirit Bond cover. Your private progress page created.",
  },
  { date: "2026-10-14", text: "Book trailer completed and added to your package as a free bonus." },
  {
    date: "2026-10-14",
    text: "First version of your website built: six pages, contact form and reader newsletter sign up.",
  },
];

export const HUGH_FILE_NAMES = HUGH_ITEMS.flatMap((item) => item.files.map((f) => f.name));
