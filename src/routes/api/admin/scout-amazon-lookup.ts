import { createFileRoute } from "@tanstack/react-router";
import * as cheerio from "cheerio";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth.server";
import { amazonProduct } from "@/lib/scout/amazon-url";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const schema = z.object({ amazonUrl: z.string().trim().min(1).max(2000) });

function cleanTitle(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractAuthor($: cheerio.CheerioAPI): string | undefined {
  const byline = $("#bylineInfo");
  const link = byline.find("a.author, a.contributorNameID, a").first();
  const linkText = cleanTitle(link.text());
  if (linkText) return linkText;
  const bylineText = cleanTitle(byline.text());
  const match = bylineText.match(/by\s+(.+?)\s*\(/i) ?? bylineText.match(/^by\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

export const Route = createFileRoute("/api/admin/scout-amazon-lookup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request)))
          return json({ ok: false, error: "unauthorized" }, 401);
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);

        let product;
        try {
          product = amazonProduct(parsed.data.amazonUrl);
        } catch (error) {
          return json(
            { ok: false, error: "invalid_amazon_book", message: (error as Error).message },
            400,
          );
        }

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15_000);
          const response = await fetch(product.url, {
            signal: controller.signal,
            headers: {
              "user-agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              accept: "text/html,application/xhtml+xml",
              "accept-language": "en-US,en;q=0.9",
            },
          }).finally(() => clearTimeout(timeout));
          if (!response.ok)
            return json(
              {
                ok: false,
                error: "lookup_failed",
                message: `Amazon returned ${response.status}. Enter the title and author from the page by hand.`,
              },
              200,
            );

          const html = await response.text();
          const $ = cheerio.load(html);
          const title = cleanTitle($("#productTitle").first().text());
          const authorName = extractAuthor($);

          if (!title || !authorName)
            return json({
              ok: true,
              asin: product.asin,
              sourceUrl: product.url,
              title: title || undefined,
              authorName,
              message:
                "Couldn't read the full title and author automatically. Confirm or fill them in by hand.",
            });

          return json({ ok: true, asin: product.asin, sourceUrl: product.url, title, authorName });
        } catch {
          return json({
            ok: false,
            error: "lookup_unavailable",
            message:
              "Couldn't reach the Amazon page. Enter the title and author from the page by hand.",
          });
        }
      },
    },
  },
});
