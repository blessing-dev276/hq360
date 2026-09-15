import { BRAND } from "@/config/brand";

/**
 * No transactional email provider is configured yet, so as a stopgap we hand
 * the visitor a pre-filled Gmail compose tab addressed to the inbox — the
 * lead is already saved server-side either way, this just gets a copy into
 * the mailbox without needing SMTP/API credentials.
 */
export function gmailComposeUrl(input: { subject: string; body: string }): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: BRAND.email,
    su: input.subject,
    body: input.body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

/**
 * Opens a blank tab synchronously — call this directly inside the click
 * handler, before any `await`. Popup blockers (Safari in particular) only
 * allow `window.open` while still inside the same tick as a real user
 * gesture; navigating an already-open tab afterwards is not restricted.
 */
export function openBlankLeadTab(): Window | null {
  if (typeof window === "undefined") return null;
  const win = window.open("about:blank", "_blank");
  if (win) win.opener = null;
  return win;
}

/** Point a tab opened by `openBlankLeadTab` at the Gmail compose URL. */
export function navigateLeadTab(
  win: Window | null,
  input: { subject: string; body: string },
): void {
  if (!win || win.closed) return;
  win.location.href = gmailComposeUrl(input);
}
