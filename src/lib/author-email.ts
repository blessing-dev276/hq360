import { z } from "zod";

export const authorEmailSchema = z.object({
  to: z.string().trim().email().max(254),
  subject: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[^\r\n]+$/, "Subject must be one line."),
  content: z.string().trim().min(1).max(20000),
  senderName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[^\r\n]+$/),
  requestId: z.string().uuid(),
  isTest: z.boolean().default(false),
});
export const exampleSubject = "Arlen Voss: the survival premise of Fragments of Light";
export const exampleContent = `Arlen,

Truth and connection help repair a fractured world. That particular story choice is the starting point for introducing Fragments of Light to interested readers.

I would first check how the book appears on Amazon and Goodreads rather than assume anything is missing.

**Goodreads Listopia Placement**: We would identify eligible reader lists aligned with Fragments of Light's particular themes and prepare relevant submissions. This is a proposed test, not a claim that the book lacks placements.

**Amazon Keyword and Category Optimization**: We would examine the live Amazon listing and compare relevant post-apocalyptic search terms and category options before recommending any changes.

**Genre Competitor Research**: We would study comparable survival fiction and clarify how Fragments of Light's premise differs from books its intended audience already reads.

**Book Club Outreach**: We would develop discussion questions around the story's central conflict and approach reading groups interested in these themes.

The central conflict of Fragments of Light should guide its reader-facing presentation.

If you are open to it, I can put together a short priority list of the exact Listopia lists where Fragments of Light belongs and the categories worth testing, so you have something concrete in hand before we even speak. Just say the word "YES".`;

const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
// Deliberately limited formatting: raw HTML is always escaped.
function inline(value: string) {
  return esc(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#111416">$1</strong>')
    .replace(/\n/g, "<br>");
}
export function buildAuthorEmail(input: { subject: string; content: string; senderName: string }) {
  const content = input.content.replace(/\r\n/g, "\n");
  const blocks = content
    .split(/\n\s*\n|\n(?=\*\*)/)
    .filter((x) => x.trim())
    .map((block) => {
      const service = block.trim().match(/^\*\*([^*]+)\*\*:?\s*([\s\S]*)$/);
      return service
        ? `<tr><td style="padding:0 28px 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="border-left:3px solid #ff5a00;background:#fff8f3;padding:16px 18px"><p style="margin:0 0 6px;font-size:15px;font-weight:bold;color:#111416">${esc(service[1]!)}</p><p style="margin:0;font-size:15px;line-height:1.7;color:#454545">${inline(service[2]!)}</p></td></tr></table></td></tr>`
        : `<tr><td style="padding:0 28px 18px;font-size:16px;line-height:1.75;color:#353535">${inline(block.trim())}</td></tr>`;
    })
    .join("");
  const optOut = "Prefer not to hear from us? Reply STOP and we will not contact you again.";
  return {
    text: `${content.replace(/\*\*([^*]+)\*\*/g, "$1")}\n\n${input.senderName}\nHQ360 — Author services\nhttps://www.hq360.space/authors\n\n${optOut}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(input.subject)}</title></head><body style="margin:0;background:#f5f3ef"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 8px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border-top:4px solid #ff5a00;font-family:Arial,Helvetica,sans-serif"><tr><td style="padding:28px"><a href="https://www.hq360.space/authors" style="font-size:26px;font-weight:800;color:#111416;text-decoration:none">HQ<span style="color:#ff5a00">360</span></a><p style="font-size:10px;letter-spacing:2px;color:#777;margin:8px 0 0">FOR AUTHORS &amp; THEIR STORIES</p></td></tr>${blocks}<tr><td style="padding:8px 28px 28px"><p style="margin:0;font-size:16px;font-weight:bold;color:#111416">${esc(input.senderName)}</p><p style="margin:6px 0 0;font-size:13px;color:#666"><a href="https://www.hq360.space/authors" style="color:#b83f00">HQ360</a> · Author services</p></td></tr><tr><td style="padding:20px 28px;border-top:1px solid #eee;font-size:12px;line-height:1.6;color:#737373">${optOut}</td></tr></table></td></tr></table></body></html>`,
  };
}
