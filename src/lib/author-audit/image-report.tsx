import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { BRAND } from "@/config/brand";
import type { AuditFinding } from "./db";

const WIDTH = 1080;
const HEIGHT = 1350;
const INK = "#161311";
const ORANGE = "#e2571f";
const CREAM = "#f6f2ec";

// Satori's bundled font parser only reads WOFF (v1) / TTF / OTF, not the
// WOFF2 files the site itself serves — fetch WOFF1 straight from Google
// Fonts instead. The legacy user-agent is what makes their CSS API hand
// back a woff URL rather than woff2.
const LEGACY_UA =
  "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/30.0.0.0 Safari/537.36";

let fontCache: { inter: ArrayBuffer; display: ArrayBuffer } | null = null;

async function fetchGoogleFontWoff(family: string, weight: number): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}:${weight}`,
    { headers: { "user-agent": LEGACY_UA } },
  ).then((r) => r.text());
  const url = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff)\)/)?.[1];
  if (!url) throw new Error(`Could not resolve a WOFF URL for ${family} ${weight}`);
  return fetch(url).then((r) => r.arrayBuffer());
}

async function fonts() {
  if (fontCache) return fontCache;
  const [inter, display] = await Promise.all([
    fetchGoogleFontWoff("Inter", 400),
    fetchGoogleFontWoff("Space Grotesk", 700),
  ]);
  fontCache = { inter, display };
  return fontCache;
}

const PRIORITY_ORDER: AuditFinding["priority"][] = [
  "immediate",
  "high_impact",
  "medium_priority",
  "long_term",
  "optional",
];

export async function renderAuditImage(input: {
  authorName: string;
  bookTitle: string;
  strengths: string[];
  findings: AuditFinding[];
}): Promise<Buffer> {
  const { inter, display } = await fonts();

  const topOpportunities = [...input.findings]
    .filter((f) => f.status === "opportunity_identified" || f.status === "needs_attention")
    .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority))
    .slice(0, 3);

  const svg = await satori(
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        display: "flex",
        flexDirection: "column",
        backgroundColor: INK,
        padding: 72,
        fontFamily: "Inter",
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", fontFamily: "Space Grotesk", fontSize: 30, color: "#fff" }}>
          {BRAND.name}
        </div>
        <div
          style={{
            display: "flex",
            width: 6,
            height: 6,
            borderRadius: 999,
            backgroundColor: ORANGE,
          }}
        />
      </div>
      <div
        style={{ display: "flex", fontSize: 15, letterSpacing: 3, color: ORANGE, marginTop: 28 }}
      >
        AUTHOR VISIBILITY AUDIT
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontFamily: "Space Grotesk",
          fontSize: 46,
          lineHeight: 1.15,
          marginTop: 18,
          color: "#fff",
        }}
      >
        {input.bookTitle}
      </div>
      <div style={{ display: "flex", fontSize: 22, color: "#c9c2b8", marginTop: 12 }}>
        {input.authorName}
      </div>

      <div
        style={{
          display: "flex",
          width: "100%",
          height: 1,
          backgroundColor: "#3a352f",
          marginTop: 40,
        }}
      />

      <div
        style={{ display: "flex", fontSize: 14, letterSpacing: 2, color: "#9a9188", marginTop: 40 }}
      >
        KEY STRENGTHS
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 16, gap: 14 }}>
        {(input.strengths.length > 0 ? input.strengths.slice(0, 3) : ["Unable to verify"]).map(
          (s, i) => (
            <div key={i} style={{ display: "flex", fontSize: 21, color: "#fff", lineHeight: 1.4 }}>
              {s}
            </div>
          ),
        )}
      </div>

      <div
        style={{ display: "flex", fontSize: 14, letterSpacing: 2, color: "#9a9188", marginTop: 44 }}
      >
        TOP OPPORTUNITIES
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 16, gap: 18, flex: 1 }}>
        {(topOpportunities.length > 0
          ? topOpportunities.map((f) => f.observation)
          : ["Unable to verify"]
        ).map((text, i) => (
          <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div
              style={{
                display: "flex",
                width: 36,
                height: 36,
                borderRadius: 999,
                backgroundColor: ORANGE,
                color: "#fff",
                fontSize: 17,
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontFamily: "Space Grotesk",
              }}
            >
              {i + 1}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 19,
                color: "#e8e3da",
                lineHeight: 1.4,
                paddingTop: 4,
              }}
            >
              {text}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid #3a352f",
          paddingTop: 24,
          marginTop: 24,
        }}
      >
        <div style={{ display: "flex", fontSize: 15, color: CREAM }}>{BRAND.name}</div>
        <div style={{ display: "flex", fontSize: 13, color: "#9a9188" }}>
          {BRAND.siteUrl.replace(/^https?:\/\//, "")}
        </div>
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: "Inter", data: inter, weight: 400, style: "normal" },
        { name: "Space Grotesk", data: display, weight: 700, style: "normal" },
      ],
    },
  );

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } });
  return Buffer.from(resvg.render().asPng());
}
