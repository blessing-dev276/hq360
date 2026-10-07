import { AlertCircle, CircleCheck, CircleHelp, Loader2, ShieldCheck } from "lucide-react";

export type EmailCheck = {
  status?: string | null | undefined;
  details?: { reasons?: string[] | undefined } | null | undefined;
};

const LOOK: Record<string, { label: string; className: string; Icon: typeof CircleCheck }> = {
  verified_source: {
    label: "Verified on source",
    className: "border-emerald-500/50 bg-emerald-500/15 text-emerald-500",
    Icon: ShieldCheck,
  },
  likely_valid: {
    label: "Likely valid",
    className: "border-sky-500/50 bg-sky-500/15 text-sky-500",
    Icon: CircleCheck,
  },
  unconfirmed: {
    label: "Unconfirmed",
    className: "border-amber-500/50 bg-amber-500/15 text-amber-500",
    Icon: CircleHelp,
  },
  invalid: {
    label: "Invalid",
    className: "border-red-500/50 bg-red-500/15 text-red-500",
    Icon: AlertCircle,
  },
};

/** Free automatic email check result (see lib/scout/email-check.server.ts).
 *  Hover/focus shows why. Renders nothing for emails never checked. */
export function EmailCheckBadge({ status, details }: EmailCheck) {
  if (!status) return null;
  if (status === "pending" || status === "checking")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 motion-safe:animate-spin" aria-hidden="true" /> Checking…
      </span>
    );
  const look = LOOK[status];
  if (!look) return null;
  const why = details?.reasons?.join(" ") ?? "";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${look.className}`}
      title={why}
      aria-label={why ? `${look.label}: ${why}` : look.label}
    >
      <look.Icon className="size-3" aria-hidden="true" /> {look.label}
    </span>
  );
}
