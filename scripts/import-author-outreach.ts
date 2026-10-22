// Read-only by default. --apply imports only emails with this composer's exact
// branded markers. Does not send email. Historical test/author type is unknown.
import { createClient } from "@supabase/supabase-js";
const apply = process.argv.includes("--apply");
const key = process.env.RESEND_API_KEY;
if (!key) throw new Error("RESEND_API_KEY is required");
type ResendEmail = {
  id: string;
  created_at: string;
  to: string[];
  from: string;
  reply_to?: string[] | string;
  subject: string;
  html?: string;
  text?: string;
  last_event?: string;
};
async function resend<T>(path: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const response = await fetch(`https://api.resend.com${path}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20000),
    });
    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
    if (!response.ok) throw new Error(`Resend read failed: ${response.status}`);
    return response.json();
  }
  throw new Error("Resend retry limit reached");
}
const db = apply
  ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })
  : null;
let after = "";
let checked = 0;
let imported = 0;
let matches = 0;
// The author composer was introduced on 13 October 2026. Only inspect messages
// on or after that date, and require both original template markers.
let stop = false;
while (!stop) {
  const page = await resend<{ data: ResendEmail[]; has_more: boolean }>(
    `/emails?limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`,
  );
  for (const item of page.data || []) {
    if (Date.parse(item.created_at) < Date.parse("2026-10-13T00:00:00Z")) {
      stop = true;
      break;
    }
    const email = await resend<ResendEmail>(`/emails/${encodeURIComponent(item.id)}`);
    checked++;
    if (
      !email.html?.includes("FOR AUTHORS &amp; THEIR STORIES") ||
      !email.html.includes("Prefer not to hear from us? Reply STOP")
    )
      continue;
    matches++;
    if (db) {
      if (email.to?.length !== 1)
        throw new Error("Unexpected multiple recipients in historical outreach.");
      const { error } = await db.from("author_outreach").upsert(
        {
          id: email.id,
          fingerprint: `import/${email.id}`,
          recipient: email.to[0].toLowerCase(),
          subject: email.subject,
          content: email.text || "",
          sender_name: "",
          from_address: email.from,
          reply_to: Array.isArray(email.reply_to)
            ? email.reply_to.join(", ")
            : email.reply_to || "",
          html: email.html,
          plain_text: email.text || "",
          source: "resend_import",
          is_test: false,
          send_status: "accepted",
          provider_id: email.id,
          delivery_status: email.last_event || null,
          checked_at: new Date().toISOString(),
          created_at: email.created_at,
        },
        { onConflict: "provider_id", ignoreDuplicates: true },
      );
      if (error) throw new Error(`Import failed: ${error.code}`);
      imported++;
    }
    if (matches % 10 === 0) console.log(`Matched ${matches} composer emails.`);
  }
  if (!page.has_more || !page.data?.length) break;
  after = page.data.at(-1)!.id;
}
console.log(
  JSON.stringify({
    apply,
    checked,
    matches,
    processed: imported,
    note: "Imported emails have unverified test/author type; existing records are left unchanged.",
  }),
);
