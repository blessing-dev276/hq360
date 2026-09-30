import { createFileRoute } from "@tanstack/react-router";
import { ExpertApp } from "@/components/expert/ExpertApp";
import { ExpertGate } from "@/components/expert/ExpertGate";

export const Route = createFileRoute("/expert")({
  head: () => ({
    meta: [{ title: "Expert workspace | HQ360" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ExpertPage,
});

function ExpertPage() {
  return (
    <ExpertGate>
      <ExpertApp />
    </ExpertGate>
  );
}
