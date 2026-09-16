import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  adminConfigured,
  clearCookie,
  isAdminRequest,
  sessionCookie,
  verifyCredentials,
} from "@/lib/admin-auth.server";

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const Route = createFileRoute("/api/admin/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!adminConfigured()) {
          return json({ authed: false, configured: false });
        }
        return json({ authed: await isAdminRequest(request), configured: true });
      },
      POST: async ({ request }) => {
        if (!adminConfigured()) {
          return json({ ok: false, error: "not_configured" }, 503);
        }
        let body: z.infer<typeof loginSchema>;
        try {
          body = loginSchema.parse(await request.json());
        } catch {
          return json({ ok: false, error: "invalid" }, 400);
        }
        if (!verifyCredentials(body.username, body.password)) {
          return json({ ok: false, error: "wrong_credentials" }, 401);
        }
        return json({ ok: true }, 200, { "set-cookie": await sessionCookie() });
      },
      DELETE: async () => {
        return json({ ok: true }, 200, { "set-cookie": clearCookie() });
      },
    },
  },
});
