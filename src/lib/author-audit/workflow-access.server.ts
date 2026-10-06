import { isAdminRequest } from "@/lib/admin-auth.server";
import { isExpertRequest, expertHasFeature } from "@/lib/expert-auth.server";
import { clientDb } from "./client-access.server";
export async function auditActor(request: Request, id?: string) {
  if (await isAdminRequest(request)) return { id: "admin", admin: true, review: true };
  const expert = await isExpertRequest(request);
  if (!expert || !(await expertHasFeature(expert, "audit"))) return null;
  if (!id) return { id: expert, admin: false, review: false };
  const { data, error } = await clientDb()
    .from("audit_assignments")
    .select("role")
    .eq("audit_id", id)
    .eq("expert_id", expert)
    .maybeSingle();
  if (error || !data) return null;
  // Research is validated automatically, so there's no separate human review
  // step: anyone working on the audit can approve and generate its client site.
  return { id: expert, admin: false, review: Boolean(data.role) };
}
