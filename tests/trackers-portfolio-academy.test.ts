import { describe, expect, test } from "bun:test";
import { portfolioEntry, stripPrivate, type PortfolioSource } from "../src/lib/trackers/portfolio.server";
import {
  contentInputSchema,
  isNew,
  parseBody,
  safeSvg,
  targetingPolicyIssues,
  todaysLesson,
  type ContentRecord,
} from "../src/lib/academy/content";

const source = (patch: { item?: Partial<PortfolioSource["item"]>; tracker?: Partial<PortfolioSource["tracker"]>; media?: PortfolioSource["media"] } = {}): PortfolioSource => ({
  item: {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Book trailer",
    status: "done",
    portfolio_ready: true,
    portfolio_blurb: "A 62 second cinematic trailer with an original soundtrack.",
    ...patch.item,
  },
  tracker: {
    portfolio_consent: true,
    consent_allows_naming: false,
    client_name: "Hugh Murphy",
    project_title: "Memories And Observations",
    status: "live",
    ...patch.tracker,
  },
  media: patch.media === undefined ? { kind: "video" } : patch.media,
});

describe("phase 3: auto portfolio", () => {
  test("nothing is published without consent, a Complete item and Portfolio ready", () => {
    expect(portfolioEntry(source())).not.toBeNull();
    expect(portfolioEntry(source({ tracker: { portfolio_consent: false } }))).toBeNull();
    expect(portfolioEntry(source({ item: { status: "progress" } }))).toBeNull();
    expect(portfolioEntry(source({ item: { portfolio_ready: false } }))).toBeNull();
    expect(portfolioEntry(source({ tracker: { status: "archived" } }))).toBeNull();
    expect(portfolioEntry(source({ item: { portfolio_blurb: "" } }))).toBeNull();
  });

  test("names the client or book only when consent allows it", () => {
    expect(portfolioEntry(source())!.description).not.toContain("Hugh");
    const named = portfolioEntry(source({ tracker: { consent_allows_naming: true } }))!;
    expect(named.description).toContain("Memories And Observations · Hugh Murphy");
  });

  test("media is served through the consent checking proxy, never a public copy", () => {
    const entry = portfolioEntry(source())!;
    expect(entry.video_url).toBe("/api/public/portfolio-media/11111111-1111-4111-8111-111111111111");
    expect(entry.image_url).toBeNull();
    expect(portfolioEntry(source({ media: null }))!.video_url).toBeNull();
  });

  test("private details are stripped", () => {
    const text = stripPrivate(
      "Delivered for client@example.com. Paid £450 in full. Call +44 28 9012 3456. Passcode is BRIDGE-1234. A moving trailer.",
    );
    for (const leaked of ["client@example.com", "450", "9012", "BRIDGE"]) expect(text).not.toContain(leaked);
    expect(text).toContain("A moving trailer.");
  });
});

const record = (patch: Partial<ContentRecord>): ContentRecord => ({
  id: crypto.randomUUID(),
  kind: "daily_lesson",
  playbook: "author",
  slug: "x",
  number: null,
  part: "",
  group_name: "",
  title: "Lesson",
  summary: "",
  body: "",
  fields: {},
  svg: null,
  sort_order: 0,
  published: true,
  published_at: "2026-10-20T07:00:00Z",
  lesson_date: null,
  updated_at: "2026-10-20T07:00:00Z",
  updated_by: "Trainer",
  ...patch,
});

describe("phase 1: academy content", () => {
  const now = new Date("2026-10-20T15:00:00Z");

  test("new content shows the New badge for 7 days", () => {
    expect(isNew("2026-10-20T07:00:00Z", now)).toBe(true);
    expect(isNew("2026-10-14T16:00:00Z", now)).toBe(true);
    expect(isNew("2026-10-13T14:00:00Z", now)).toBe(false);
    expect(isNew(null, now)).toBe(false);
  });

  test("Today's lesson is the newest daily lesson from the last 7 days", () => {
    const lessons = [
      record({ title: "Older", published_at: "2026-10-19T07:00:00Z" }),
      record({ title: "Price questions", published_at: "2026-10-20T07:00:00Z" }),
      record({ title: "Chapter 27", kind: "chapter", published_at: "2026-10-20T09:00:00Z" }),
      record({ title: "Draft", published: false, published_at: "2026-10-20T10:00:00Z" }),
    ];
    expect(todaysLesson(lessons, now)?.title).toBe("Price questions");
    expect(todaysLesson([record({ published_at: "2026-09-01T00:00:00Z" })], now)).toBeNull();
  });

  test("chapter text supports headings, lists, tables, Copy prompts and diagrams", () => {
    const blocks = parseBody(
      "### Six step routine\n1. Open ChatGPT\n2. Paste the prompt\n\n> copy: Find ten bakeries in Leeds with no website.\n\n| Method | When |\n|---|---|\n| Email | Listed on site |\n\n[[diagram:lead-funnel]]\n[[typo\nPlain _italic_ text",
    );
    expect(blocks.map((b) => b.type)).toEqual(["heading", "list", "copy", "table", "diagram", "paragraph"]);
    expect(blocks[3]).toEqual({ type: "table", header: ["Method", "When"], rows: [["Email", "Listed on site"]] });
  });

  test("diagrams must be clean SVG (rendered through <img>, so scripts never run)", () => {
    expect(safeSvg('<svg viewBox="0 0 10 10"><style>@media (prefers-color-scheme: dark){rect{fill:#fff}}</style><rect/></svg>')).toBe(true);
    expect(safeSvg("<svg><script>alert(1)</script></svg>")).toBe(false);
    expect(safeSvg('<svg onload="alert(1)"></svg>')).toBe(false);
    expect(safeSvg('<svg><a href="javascript:alert(1)"/></svg>')).toBe(false);
    expect(safeSvg('<svg><image href="https://tracker.example/x.png"/></svg>')).toBe(false);
    expect(safeSvg("<html></html>")).toBe(false);
  });

  test("trainers cannot publish content that targets African countries", () => {
    expect(targetingPolicyIssues({ title: "Which countries to target", summary: "", body: "United Kingdom, Ireland, Canada", fields: {} })).toEqual([]);
    expect(targetingPolicyIssues({ title: "Countries", summary: "", body: "Try Nigeria and Kenya", fields: {} })).toEqual(["nigeria", "kenya"]);
    expect(targetingPolicyIssues({ title: "x", summary: "", body: "", fields: { countries: "South Africa" } }).length).toBeGreaterThan(0);
  });

  test("content input is validated", () => {
    const base = {
      kind: "niche_guide",
      playbook: "business",
      slug: "bakeries",
      number: null,
      part: "",
      group_name: "Food and drink",
      title: "Bakeries",
      summary: "",
      body: "",
      fields: { first_message: "Hello" },
      svg: null,
      sort_order: 0,
      published: true,
      lesson_date: null,
    };
    expect(contentInputSchema.safeParse(base).success).toBe(true);
    expect(contentInputSchema.safeParse({ ...base, slug: "Bad Slug" }).success).toBe(false);
    expect(contentInputSchema.safeParse({ ...base, kind: "diagram" }).success).toBe(false);
    expect(contentInputSchema.safeParse({ ...base, svg: "<svg><script/></svg>" }).success).toBe(false);
  });
});
