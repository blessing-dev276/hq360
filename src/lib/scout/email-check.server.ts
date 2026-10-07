import { createHash } from "node:crypto";
import { promises as dns } from "node:dns";

// Free email verification for Scout contacts. No paid API: every signal here
// is public (DNS, the page the email came from, Gravatar). It cannot prove a
// mailbox is read -- nothing free can -- so the result is a confidence label
// backed by the evidence it found.

export type EmailCheckStatus = "verified_source" | "likely_valid" | "unconfirmed" | "invalid";

export type EmailCheckResult = {
  status: EmailCheckStatus;
  checks: {
    format: boolean;
    mailServer: boolean | null; // null = DNS lookup failed (unknown)
    onSource: boolean;
    sourceChecked: string[];
    domainMatchesWebsite: boolean;
    freeMailbox: boolean;
    roleAddress: boolean;
    disposable: boolean;
    gravatar: boolean;
  };
  reasons: string[];
};

const FORMAT =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const FREE_MAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "zoho.com",
  "mail.com",
  "yandex.com",
]);
const DISPOSABLE = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "throwawaymail.com",
  "fakeinbox.com",
  "mintemail.com",
]);
const ROLE =
  /^(info|contact|hello|admin|support|sales|office|team|enquiries|inquiries|media|press|marketing|webmaster|noreply|no-reply)@/i;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function hasMailServer(domain: string): Promise<boolean | null> {
  try {
    const mx = await withTimeout(dns.resolveMx(domain), 4000);
    if (mx.some((r) => r.exchange && r.exchange !== ".")) return true;
    return false;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND" || code === "ENODATA") {
      // No MX: mail falls back to the domain's own address (RFC 5321).
      try {
        const a = await withTimeout(dns.resolve4(domain), 3000);
        return a.length > 0;
      } catch (inner) {
        const c = (inner as NodeJS.ErrnoException).code;
        return c === "ENOTFOUND" || c === "ENODATA" ? false : null;
      }
    }
    return null;
  }
}

function hostOf(url: string | null | undefined) {
  try {
    return url ? new URL(url).hostname.toLowerCase().replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

/** Page text with common email obfuscations undone ("name [at] site [dot] com"). */
function normalizePage(html: string) {
  return html
    .replace(/&#64;|&#x40;|%40/gi, "@")
    .replace(/&#46;|&#x2e;/gi, ".")
    .replace(/\s*[[({]\s*at\s*[\])}]\s*/gi, "@")
    .replace(/\s*[[({]\s*dot\s*[\])}]\s*/gi, ".")
    .toLowerCase();
}

async function pageMentions(url: string, email: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; HQ360-EmailCheck/1.0)" },
    });
    if (!response.ok || !/text\/html|text\/plain/i.test(response.headers.get("content-type") ?? ""))
      return false;
    const text = (await response.text()).slice(0, 1_500_000);
    return normalizePage(text).includes(email);
  } catch {
    return false;
  }
}

async function hasGravatar(email: string) {
  try {
    const hash = createHash("md5").update(email).digest("hex");
    const response = await fetch(`https://gravatar.com/avatar/${hash}?d=404&s=1`, {
      method: "HEAD",
      signal: AbortSignal.timeout(4000),
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

function safePublicUrl(url: string | null | undefined) {
  try {
    if (!url) return null;
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    // Don't let stored URLs make the server fetch private/internal hosts.
    if (
      /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname) ||
      u.hostname.endsWith(".internal")
    )
      return null;
    return u.href;
  } catch {
    return null;
  }
}

export async function checkEmail(input: {
  email: string;
  websiteUrl?: string | null;
  sourceUrl?: string | null;
}): Promise<EmailCheckResult> {
  const email = input.email.trim().toLowerCase();
  const domain = email.split("@")[1] ?? "";
  const format = FORMAT.test(email) && email.length <= 254;
  const freeMailbox = FREE_MAIL.has(domain);
  const disposable = DISPOSABLE.has(domain);
  const roleAddress = ROLE.test(email);
  const websiteHost = hostOf(input.websiteUrl);
  const domainMatchesWebsite =
    !!websiteHost &&
    !freeMailbox &&
    (domain === websiteHost ||
      websiteHost.endsWith(`.${domain}`) ||
      domain.endsWith(`.${websiteHost}`));

  const reasons: string[] = [];
  if (!format) {
    return {
      status: "invalid",
      checks: {
        format,
        mailServer: null,
        onSource: false,
        sourceChecked: [],
        domainMatchesWebsite,
        freeMailbox,
        roleAddress,
        disposable,
        gravatar: false,
      },
      reasons: ["The address isn't a valid email format."],
    };
  }

  const pages = [
    ...new Set(
      [safePublicUrl(input.sourceUrl), safePublicUrl(input.websiteUrl)].filter(Boolean) as string[],
    ),
  ];
  const [mailServer, gravatar, ...found] = await Promise.all([
    hasMailServer(domain),
    hasGravatar(email),
    ...pages.map((url) => pageMentions(url, email)),
  ]);
  const onSource = found.some(Boolean);

  let status: EmailCheckStatus;
  if (disposable) {
    status = "invalid";
    reasons.push("Temporary/disposable email domain.");
  } else if (mailServer === false) {
    status = "invalid";
    reasons.push(`${domain} can't receive email (no mail server).`);
  } else if (onSource) {
    status = "verified_source";
    reasons.push("Still published on the page it was found on.");
  } else if (mailServer && (domainMatchesWebsite || gravatar)) {
    status = "likely_valid";
    if (domainMatchesWebsite) reasons.push("Domain matches the author's website.");
    if (gravatar) reasons.push("Has a Gravatar profile.");
  } else {
    status = "unconfirmed";
    reasons.push(
      mailServer === null
        ? "Couldn't confirm the domain's mail server right now."
        : "Domain receives email, but no public evidence links it to this person.",
    );
  }
  if (roleAddress) reasons.push("Generic team inbox (e.g. info@), may not reach the author.");
  return {
    status,
    checks: {
      format,
      mailServer,
      onSource,
      sourceChecked: pages,
      domainMatchesWebsite,
      freeMailbox,
      roleAddress,
      disposable,
      gravatar,
    },
    reasons,
  };
}
