import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { canFindContacts, canSeeAuthor, resolveScoutAccess } from "@/lib/scout/owner.server";
import { asScoutDb } from "@/lib/scout/db";
import { checkEmailRun, createEmailRun, emailDb } from "@/lib/scout/email-budget.server";
import { PerplexityError } from "@/lib/perplexity/agent.server";
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function emailRunsHandler(request: Request) {
  const access = await resolveScoutAccess(request);
  if (!access) return json({ message: "Unauthorized" }, 401);
  if (!(await canFindContacts(access))) return json({ message: "Scouting access required." }, 403);
  try {
    if (request.method === "GET") {
      const id = z.string().uuid().parse(new URL(request.url).searchParams.get("id"));
      const run = await checkEmailRun(id, access.owner);
      const { data: results, error } = await emailDb()
        .from("scout_email_run_results")
        .select("*")
        .eq("run_id", id);
      if (error) throw error;
      const { data: attempts, error: attemptError } = await emailDb()
        .from("scout_email_attempts")
        .select("actual_usd,reserved_usd,settled")
        .eq("run_id", id);
      if (attemptError) throw attemptError;
      return json({
        run,
        results,
        actualUsd: (attempts ?? []).reduce((n, a) => n + Number(a.actual_usd ?? 0), 0),
        unsettled: (attempts ?? []).filter((a) => !a.settled).length,
      });
    }
    if (request.headers.get("origin") !== new URL(request.url).origin)
      return json({ message: "Invalid origin." }, 403);
    const body = z
      .object({
        budgetUsd: z.number().min(0.1).max(25),
        targets: z
          .array(z.object({ authorId: z.string().uuid(), bookId: z.string().uuid() }).strict())
          .min(1)
          .max(500),
      })
      .strict()
      .parse(await request.json());
    for (const target of body.targets)
      if (!(await canSeeAuthor(asScoutDb(emailDb()), access.owner, target.authorId)))
        return json({ message: "Author not found." }, 404);
    return json({ run: await createEmailRun(access.owner, body.budgetUsd, body.targets) });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return json({ message: "Invalid search budget request." }, 400);
    if (error instanceof PerplexityError) return json({ message: error.message }, error.status);
    return json({ message: "Could not load email search budget." }, 503);
  }
}
export const Route = createFileRoute("/api/admin/scout-email-runs")({
  server: {
    handlers: {
      GET: ({ request }) => emailRunsHandler(request),
      POST: ({ request }) => emailRunsHandler(request),
    },
  },
});
