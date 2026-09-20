import { createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/components/admin/AdminGate";
import { ScoutApp } from "@/components/admin/ScoutApp";

export const Route = createFileRoute("/scout")({
  head: () => ({
    meta: [
      { title: "Scout — Author Prospecting | HQ360" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ScoutPage,
});

function ScoutPage() {
  return (
    <AdminGate>
      <ScoutApp />
    </AdminGate>
  );
}
