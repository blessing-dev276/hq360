import { createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminApp } from "@/components/admin/AdminApp";

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
      <AdminApp initialTab="scout" />
    </AdminGate>
  );
}
