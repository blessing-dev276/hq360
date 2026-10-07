import { createFileRoute } from "@tanstack/react-router";
import { PrivateAuditAccess } from "@/components/site/PrivateAuthorAudit";
export const Route = createFileRoute("/author-audit/")({
  head: () => ({
    meta: [{ title: "Your private HQ360 audit" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: PrivateAuditAccess,
});
