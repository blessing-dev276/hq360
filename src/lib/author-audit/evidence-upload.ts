import type { WorkflowState } from "./workflow";

/** Resolve links against this audit before writing anything to private storage. */
export function evidenceUploadTarget(
  state: Pick<WorkflowState, "tasks" | "findings" | "listopia">,
  refs: { taskId: string | null; findingId: string | null; listopiaId: string | null },
) {
  const task = state.tasks.find((item) => item.id === refs.taskId);
  const finding = state.findings.find((item) => item.id === refs.findingId);
  const list = state.listopia.find((item) => item.id === refs.listopiaId);
  if (refs.taskId && !task) throw new Error("Invalid screenshot request");
  if (refs.findingId && !finding) throw new Error("Invalid finding");
  if (refs.listopiaId && !list) throw new Error("Invalid Listopia list");
  return {
    task_id: refs.taskId,
    finding_id: refs.findingId,
    listopia_id: refs.listopiaId,
    category: list
      ? "goodreads_listopia_audit"
      : (task?.category ?? finding?.category ?? "general"),
    ...(list ? { source: list.list_url, caption: `Ranking screenshot — ${list.list_name}` } : {}),
  };
}
