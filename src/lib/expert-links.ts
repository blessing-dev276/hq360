import { z } from "zod";

/** https:// link whose host is the given platform (or a subdomain of it). */
export function platformUrl(domain: string, label: string) {
  return z
    .string()
    .trim()
    .max(300)
    .url()
    .refine((value) => value.startsWith("https://"), "Use an https:// link")
    .refine((value) => {
      try {
        const host = new URL(value).hostname.toLowerCase();
        return host === domain || host.endsWith(`.${domain}`);
      } catch {
        return false;
      }
    }, `Use a ${label} link`)
    .or(z.literal(""));
}

export const fiverrUrl = platformUrl("fiverr.com", "Fiverr");
export const upworkUrl = platformUrl("upwork.com", "Upwork");
