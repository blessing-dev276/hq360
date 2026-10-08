// Proposals shared by the editor, the public /proposal page and the email.

export type ProposalDetail = { label: string; value: string };

export type Proposal = {
  id?: string;
  token?: string;
  title: string;
  client_name: string;
  client_email: string;
  subtitle: string;
  details: ProposalDetail[];
  body: string;
  prepared_by: string;
  prepared_by_role: string;
  footer_note: string;
  sent_at?: string | null;
  sent_to?: string | null;
  views?: number;
  last_viewed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export const EMPTY_PROPOSAL: Proposal = {
  title: "",
  client_name: "",
  client_email: "",
  subtitle: "",
  details: [
    { label: "Prepared by", value: "HQ360" },
    { label: "Website", value: "https://www.hq360.space" },
  ],
  body: "",
  prepared_by: "Blessing",
  prepared_by_role: "Founder & CEO, HQ360",
  footer_note: "",
};

/* ------------------------------------------------------------ formatting */

export type Block =
  | { kind: "h1" | "h2" | "h3" | "p"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "callout"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] };

/**
 * A deliberately small formatter, so proposals can be written as plain text:
 *   ## Heading        ### Sub-heading
 *   - bullet          1. numbered
 *   > Important: ...  (callout box)
 *   | A | B |         (table; first row is the header)
 *   **bold**          links are detected automatically
 */
export function parseProposal(body: string): Block[] {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flush();
      blocks.push({
        kind: (["h1", "h2", "h3"] as const)[heading[1]!.length - 1]!,
        text: heading[2]!,
      });
      continue;
    }
    if (/^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      flush();
      const ordered = /^\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i]!.trim();
        const m = ordered ? l.match(/^\d+[.)]\s+(.*)$/) : l.match(/^[-*•]\s+(.*)$/);
        if (!m) break;
        items.push(m[1]!);
        i++;
      }
      i--;
      blocks.push({ kind: ordered ? "ol" : "ul", items });
      continue;
    }
    if (line.startsWith(">")) {
      flush();
      const parts: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith(">")) {
        parts.push(lines[i]!.trim().replace(/^>\s?/, ""));
        i++;
      }
      i--;
      blocks.push({ kind: "callout", text: parts.join(" ") });
      continue;
    }
    if (line.startsWith("|")) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) {
        const cells = lines[i]!.trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      if (rows.length) blocks.push({ kind: "table", head: rows[0]!, rows: rows.slice(1) });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

/** Inline pieces: bold and links. */
export type Inline = { text: string; bold?: boolean; href?: string };
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    if (m[1]) out.push({ text: m[1], bold: true });
    else out.push({ text: m[2]!, href: m[2]! });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
