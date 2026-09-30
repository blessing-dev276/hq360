import { createFileRoute } from "@tanstack/react-router";
// Retired provider: do not process notifications or change invoice records.
export const Route = createFileRoute("/api/payments/paystack/webhook")({
  server: {
    handlers: {
      POST: () =>
        Response.json(
          { error: "This payment provider is disabled." },
          { status: 410, headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
