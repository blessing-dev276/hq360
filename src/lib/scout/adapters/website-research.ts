/** Result contract retained for manual website enrichment and future approved adapters. */

export type WebsiteResearchResult = {
  url: string;
  status: "retrieved" | "unavailable" | "failed";
  retrievedAt: string;
  title?: string | undefined;
  metaDescription?: string | undefined;
  contactEmail?: string | undefined;
  contactFormUrl?: string | undefined;
  newsletterVisible?: boolean | undefined;
  error?: string | undefined;
};

/** Website crawling needs a reviewed, domain-specific adapter. A staff-entered URL
 * alone does not establish robots/terms permission or a safe network destination. */
export async function researchAuthorWebsite(rawUrl: string): Promise<WebsiteResearchResult> {
  return {
    url: rawUrl,
    status: "unavailable",
    retrievedAt: new Date().toISOString(),
    error:
      "Automated website enrichment requires a reviewed domain adapter. Record public website/contact evidence manually in the meantime.",
  };
}
