import { createFileRoute } from "@tanstack/react-router";
import { PrivateAuditLoader } from "@/components/site/PrivateAuthorAudit";
export const Route = createFileRoute("/author-audit/$author/$book")({
  head: () => ({
    meta: [
      { title: "Private author audit | HQ360" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});
function Page() {
  const { author, book } = Route.useParams();
  return <PrivateAuditLoader slug={`${author}/${book}`} />;
}
