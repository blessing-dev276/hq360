import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { BRAND } from "@/config/brand";
import type { AuditFinding } from "./db";
import type { ReportData } from "./report-data";

const WIDTH = 1080;
const HEIGHT = 1350;
const INK = "#111416";
const ORANGE = "#FF5A00";
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

/**
 * The executive-snapshot share image — not the audit squeezed into a
 * graphic, just enough to be useful by email preview/WhatsApp/DM: one key
 * strength and up to three priority opportunities, pulled from the same
 * approved ReportData the PDF uses.
 */
export async function renderAuditImage(data: ReportData): Promise<Buffer> {
  const { inter, display } = await fonts();

  const topOpportunities = [...data.findings]
    .filter((f) => f.status === "opportunity_identified" || f.status === "needs_attention")
    .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority))
    .slice(0, 3);
  const keyStrength = data.strengths[0]?.title ?? data.strengths[0]?.observation ?? null;

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
        AUTHOR VISIBILITY AUDIT — EXECUTIVE SNAPSHOT
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontFamily: "Space Grotesk",
          fontSize: 44,
          lineHeight: 1.15,
          marginTop: 18,
          color: "#fff",
        }}
      >
        {data.book.title}
      </div>
      <div style={{ display: "flex", fontSize: 22, color: "#c9c2b8", marginTop: 12 }}>
        {data.author.name}
      </div>

      <div
        style={{
          display: "flex",
          width: "100%",
          height: 1,
          backgroundColor: "#3a352f",
          marginTop: 36,
        }}
      />

      <div
        style={{ display: "flex", fontSize: 14, letterSpacing: 2, color: "#9a9188", marginTop: 36 }}
      >
        KEY STRENGTH
      </div>
      <div style={{ display: "flex", fontSize: 21, color: "#fff", lineHeight: 1.4, marginTop: 12 }}>
        {keyStrength ?? "Unable to verify"}
      </div>

      <div
        style={{ display: "flex", fontSize: 14, letterSpacing: 2, color: "#9a9188", marginTop: 36 }}
      >
        PRIORITY OPPORTUNITIES
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 16, gap: 18, flex: 1 }}>
        {(topOpportunities.length > 0
          ? topOpportunities.map((f) => f.title ?? f.observation)
          : ["Unable to verify"]
        ).map((text, i) => (
          <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div
              style={{
                display: "flex",
                width: 34,
                height: 34,
                borderRadius: 999,
                backgroundColor: ORANGE,
                color: "#fff",
                fontSize: 16,
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
                fontSize: 18,
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
          flexDirection: "column",
          borderTop: "1px solid #3a352f",
          paddingTop: 20,
          marginTop: 20,
        }}
      >
        <div style={{ display: "flex", fontSize: 14, color: CREAM }}>
          Full strategic audit prepared by {BRAND.name}
        </div>
        <div style={{ display: "flex", fontSize: 13, color: "#9a9188", marginTop: 4 }}>
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
