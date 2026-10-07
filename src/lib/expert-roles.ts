/** Workspace features an admin can grant to an expert. Profile and portfolio
 *  are always available; these are the extras. */
export const EXPERT_FEATURES = [
  { key: "scout", label: "Scouting", hint: "Discover authors and find contact details." },
  { key: "audit", label: "Audit", hint: "Research and build author growth reports." },
  { key: "invoices", label: "Invoices", hint: "Request invoices for their own clients." },
  {
    key: "contacts",
    label: "Find Author Contact",
    hint: "Find and verify author emails inside Scouting (needs Scouting).",
  },
] as const;
export type ExpertFeature = (typeof EXPERT_FEATURES)[number]["key"];

export const EXPERT_ROLES = [
  {
    key: "contributor",
    label: "Contributor",
    permissions: [],
    hint: "Profile and portfolio only.",
  },
  { key: "scout", label: "Scout", permissions: ["scout"], hint: "Helps find new authors." },
  { key: "analyst", label: "Analyst", permissions: ["audit"], hint: "Helps build author reports." },
  {
    key: "sales_partner",
    label: "Sales Partner",
    permissions: ["invoices"],
    hint: "Brings in clients and requests invoices.",
  },
  {
    key: "associate",
    label: "Associate",
    permissions: ["scout", "audit", "invoices"],
    hint: "Trusted helper with every expert tool.",
  },
] as const satisfies readonly {
  key: string;
  label: string;
  permissions: readonly ExpertFeature[];
  hint: string;
}[];
export type ExpertRole = (typeof EXPERT_ROLES)[number]["key"] | "custom";

export function roleLabel(role: string) {
  return EXPERT_ROLES.find((r) => r.key === role)?.label ?? "Custom";
}

/** Which feature, if any, a shared staff API path belongs to. */
export function featureForPath(pathname: string): ExpertFeature | null {
  if (pathname.startsWith("/api/admin/scout")) return "scout";
  if (pathname.startsWith("/api/admin/author-audit")) return "audit";
  return null;
}
