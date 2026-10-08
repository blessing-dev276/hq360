import { useEffect, useState } from "react";
import {
  SIGNALS,
  SERVICES,
  type CommercialConfig,
  type Pricing,
} from "@/lib/author-audit/services";
import {
  findingCommercialSchema,
  findingType,
  retrievalDates,
  type CommercialPlan,
  type ProposalDraft,
  type MatchFinding,
  type FindingCommercial,
} from "@/lib/author-audit/commercial";
import type { SavedProposal } from "@/lib/author-audit/commercial.server";
const input = "mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm";
const button = "rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50";
type Data = {
  config: CommercialConfig;
  configRevision: string;
  plan: CommercialPlan;
  proposal: SavedProposal | null;
  auditRevision: number;
  findings: MatchFinding[];
};
export function AuditCommercialAdmin({ auditId }: { auditId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [config, setConfig] = useState<CommercialConfig | null>(null);
  const [draft, setDraft] = useState<ProposalDraft | null>(null);
  const [objective, setObjective] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/admin/author-audits/${auditId}/commercial`;
  async function load() {
    const response = await fetch(endpoint);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setData(result);
    setConfig(result.config);
    setDraft(result.proposal?.draft ?? null);
    setObjective(result.plan.objective);
  }
  useEffect(() => {
    void load().catch((e) => setMessage(e.message)); /* reload per audit */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);
  async function act(action: string, extra: object = {}) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          revision: data?.proposal?.revision ?? 0,
          configRevision: data?.configRevision,
          auditRevision: data?.auditRevision,
          ...extra,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await load();
      setMessage(
        action === "share"
          ? "Approved proposal shared in the client's private audit. No message was sent."
          : "Saved. Client proposals require separate approval and sharing.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(data?.proposal?.draft);
  return (
    <section className="space-y-6 rounded-2xl border border-border p-5 sm:p-7">
      <h2 className="font-display text-2xl">HQ360 opportunities & proposals</h2>
      <p className="text-sm text-muted-foreground">
        Only cited findings can support services. Confirm rights, access and scope with the author
        before implementation.
      </p>
      {message && (
        <p role="status" className="rounded-lg bg-secondary p-3 text-sm">
          {message}
        </p>
      )}
      {data && config && (
        <>
          <label className="block">
            Author's stated objective
            <textarea
              className={input}
              value={objective}
              maxLength={2000}
              onChange={(e) => setObjective(e.target.value)}
            />
          </label>
          <button
            className={button}
            disabled={busy}
            onClick={() => void act("objective", { objective })}
          >
            Save objective
          </button>
          <div className="space-y-4">
            {data.plan.services.map((s) => (
              <article key={s.id} className="border-t border-border pt-4">
                <h3 className="font-semibold">{s.name}</h3>
                {s.matches.map((m) => (
                  <p key={m.finding_id} className="mt-2 text-sm">
                    {m.reason_for_match}{" "}
                    <span className="text-muted-foreground">
                      Eligibility: confirm prerequisites.
                    </span>
                  </p>
                ))}
                <p className="mt-2 text-sm text-muted-foreground">
                  Deliverables: {s.deliverables.join("; ")}
                </p>
              </article>
            ))}
            {!data.plan.services.length && (
              <p>No eligible recommendations yet. Add or verify cited findings first.</p>
            )}
            <button className={button} disabled={busy} onClick={() => void act("match")}>
              Save evidence-to-service mappings
            </button>
          </div>
          <details className="rounded-xl border border-border p-4">
            <summary className="cursor-pointer font-semibold">
              Finding impacts & evidence conditions
            </summary>
            <p className="my-3 text-sm text-muted-foreground">
              Extend a finding without changing its original evidence. Saving an annotation sends
              the finding back for review. A condition must quote its cited evidence.
            </p>
            {data.findings.map((f) => (
              <FindingCommercialEditor
                key={`${f.id}-${JSON.stringify(f.commercial)}`}
                finding={f}
                busy={busy}
                onSave={(commercial) => void act("annotate", { findingId: f.id, commercial })}
              />
            ))}
          </details>
          <details className="rounded-xl border border-border p-4">
            <summary className="cursor-pointer font-semibold">
              Service availability, pricing & bundles
            </summary>
            <p className="my-3 text-sm text-muted-foreground">
              Global settings. Prices remain quote-required unless an administrator enters them.
              Changing settings invalidates prior proposal approval.
            </p>
            <div className="space-y-4">
              {SERVICES.map((s) => {
                const value = config.services[s.id] ?? {
                  enabled: s.enabled,
                  pricing: s.pricing,
                  landingUrl: s.landingUrl,
                };
                const update = (patch: Partial<typeof value>) =>
                  setConfig({
                    ...config,
                    services: { ...config.services, [s.id]: { ...value, ...patch } },
                  });
                return (
                  <details key={s.id} className="border-t border-border py-2">
                    <summary className="cursor-pointer">
                      {s.name} · {value.enabled ? "Available" : "Disabled"}
                    </summary>
                    <label className="mt-3 block">
                      <input
                        type="checkbox"
                        checked={value.enabled}
                        onChange={(e) => update({ enabled: e.target.checked })}
                      />{" "}
                      Available for recommendations
                    </label>
                    <p className="mt-2 text-sm">{s.description}</p>
                    <p className="mt-2 text-sm">
                      Evidence required: {s.requiredEvidence.join("; ")}
                    </p>
                    <p className="mt-2 text-sm">Prerequisites: {s.prerequisites.join("; ")}</p>
                    <p className="mt-2 text-sm">Not suitable: {s.exclusions.join("; ")}</p>
                    <PriceEditor
                      value={value.pricing}
                      onChange={(pricing) => update({ pricing })}
                    />
                    <label className="mt-2 block text-sm">
                      Optional service page (HTTPS)
                      <input
                        className={input}
                        type="url"
                        value={value.landingUrl ?? ""}
                        onChange={(e) => update({ landingUrl: e.target.value || null })}
                      />
                    </label>
                  </details>
                );
              })}
            </div>
            <h3 className="my-4 font-semibold">Bundles</h3>
            {config.bundles.map((bundle, i) => {
              const update = (patch: Partial<typeof bundle>) =>
                setConfig({
                  ...config,
                  bundles: config.bundles.map((b, n) => (i === n ? { ...b, ...patch } : b)),
                });
              return (
                <details key={bundle.id} className="border-t border-border py-3">
                  <summary>{bundle.name}</summary>
                  <label className="mt-2 block">
                    <input
                      type="checkbox"
                      checked={bundle.enabled}
                      onChange={(e) => update({ enabled: e.target.checked })}
                    />{" "}
                    Available
                  </label>
                  <label className="block text-sm">
                    Name
                    <input
                      className={input}
                      value={bundle.name}
                      onChange={(e) => update({ name: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    Description
                    <textarea
                      className={input}
                      value={bundle.description}
                      onChange={(e) => update({ description: e.target.value })}
                    />
                  </label>
                  <fieldset className="mt-3 grid gap-2 sm:grid-cols-2">
                    <legend>Components (only supported services reach the client)</legend>
                    {SERVICES.map((s) => (
                      <label key={s.id} className="text-sm">
                        <input
                          type="checkbox"
                          checked={bundle.serviceIds.includes(s.id)}
                          onChange={(e) =>
                            update({
                              serviceIds: e.target.checked
                                ? [...bundle.serviceIds, s.id]
                                : bundle.serviceIds.filter((id) => id !== s.id),
                            })
                          }
                        />{" "}
                        {s.name}
                      </label>
                    ))}
                  </fieldset>
                  <PriceEditor value={bundle.pricing} onChange={(pricing) => update({ pricing })} />
                  <button
                    className={button}
                    onClick={() =>
                      setConfig({
                        ...config,
                        bundles: config.bundles.filter((b) => b.id !== bundle.id),
                      })
                    }
                  >
                    Remove bundle
                  </button>
                </details>
              );
            })}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className={button}
                onClick={() =>
                  setConfig({
                    ...config,
                    bundles: [
                      ...config.bundles,
                      {
                        id: `bundle-${crypto.randomUUID()}`,
                        name: "New bundle",
                        description: "",
                        serviceIds: [],
                        enabled: false,
                        pricing: { quoteRequired: true, amount: null, currency: null },
                      },
                    ],
                  })
                }
              >
                Add bundle
              </button>
              <button
                className={button}
                disabled={busy}
                onClick={() => void act("config", { config })}
              >
                Save catalogue settings
              </button>
            </div>
          </details>
          <div className="border-t border-border pt-5">
            <h3 className="font-display text-xl">Personalized proposal</h3>
            <p className="my-3 text-sm text-muted-foreground">
              Generate an editable draft from supported services. Saving changes withdraws approval
              and sharing. Approval alone does not share it.
            </p>
            <button
              className={button}
              disabled={busy || !data.plan.services.length}
              onClick={() => void act("generate")}
            >
              Generate HQ360 Proposal
            </button>
            {draft && (
              <div className="mt-5 space-y-4">
                <p>
                  State: <strong>{data.proposal?.status}</strong>
                  {dirty && " · Unsaved edits"}
                </p>
                {(
                  [
                    ["title", "Title"],
                    ["objective", "Objective"],
                    ["scope", "Scope of work"],
                    ["timeline", "Timeline (leave empty until agreed)"],
                    ["terms", "Terms"],
                    ["exclusions", "Exclusions"],
                  ] as const
                ).map(([key, title]) => (
                  <label className="block text-sm" key={key}>
                    {title}
                    <textarea
                      aria-label={title}
                      className={input}
                      value={draft[key]}
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    />
                  </label>
                ))}
                <fieldset className="space-y-2">
                  <legend>Selected services</legend>
                  {data.plan.services.map((s) => (
                    <label key={s.id} className="block text-sm">
                      <input
                        type="checkbox"
                        checked={draft.serviceIds.includes(s.id)}
                        onChange={(e) => {
                          const serviceIds = e.target.checked
                            ? [...draft.serviceIds, s.id]
                            : draft.serviceIds.filter((id) => id !== s.id);
                          const selected = data.plan.services.filter((s) =>
                            serviceIds.includes(s.id),
                          );
                          setDraft({
                            ...draft,
                            serviceIds,
                            scope: selected.map((s) => s.description).join("\n"),
                            deliverables: selected.flatMap((s) => s.deliverables),
                            dependencies: [...new Set(selected.flatMap((s) => s.prerequisites))],
                            successIndicators: selected.map((s) => s.primaryKpi),
                          });
                        }}
                      />{" "}
                      {s.name}
                    </label>
                  ))}
                </fieldset>
                {(
                  [
                    ["deliverables", "Deliverables"],
                    ["dependencies", "Dependencies / access"],
                    ["successIndicators", "Success indicators"],
                  ] as const
                ).map(([key, title]) => (
                  <label className="block text-sm" key={key}>
                    {title} (one per line)
                    <textarea
                      className={input}
                      rows={4}
                      value={draft[key].join("\n")}
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.value.split("\n") })}
                    />
                  </label>
                ))}
                <PriceEditor
                  value={draft.pricing}
                  onChange={(pricing) => setDraft({ ...draft, pricing })}
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => void act("save", { draft })}
                  >
                    Save proposal draft
                  </button>
                  <button
                    className={button}
                    disabled={busy || dirty || data.proposal?.status !== "draft"}
                    onClick={() => void act("approve")}
                  >
                    Approve proposal
                  </button>
                  <button
                    className={button}
                    disabled={busy || dirty || data.proposal?.status !== "approved"}
                    onClick={() => void act("share")}
                  >
                    Share approved proposal in private audit
                  </button>
                  {data.proposal?.status !== "draft" && (
                    <button className={button} disabled={busy} onClick={() => void act("unshare")}>
                      Withdraw approval and sharing
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
function PriceEditor({ value, onChange }: { value: Pricing; onChange: (v: Pricing) => void }) {
  return (
    <fieldset className="my-3 space-y-2 text-sm">
      <legend>Pricing</legend>
      <label className="block">
        <input
          type="checkbox"
          checked={value.quoteRequired}
          onChange={(e) =>
            onChange({ quoteRequired: e.target.checked, amount: null, currency: value.currency })
          }
        />{" "}
        Tailored quote required
      </label>
      {!value.quoteRequired && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            Amount
            <input
              className={input}
              type="number"
              min="0"
              step="0.01"
              value={value.amount ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  amount: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Currency (ISO code)
            <input
              className={input}
              maxLength={3}
              placeholder="e.g. GBP"
              value={value.currency ?? ""}
              onChange={(e) =>
                onChange({ ...value, currency: e.target.value.toUpperCase() || null })
              }
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}

function FindingCommercialEditor({
  finding,
  busy,
  onSave,
}: {
  finding: MatchFinding;
  busy: boolean;
  onSave: (c: FindingCommercial) => void;
}) {
  const [value, setValue] = useState<FindingCommercial>(
    () =>
      finding.commercial ??
      findingCommercialSchema.parse({
        finding_type: findingType(finding),
        retrieval_dates: retrievalDates(finding),
      }),
  );
  return (
    <details className="border-t border-border py-3">
      <summary className="cursor-pointer">{finding.title}</summary>
      <p className="my-3 whitespace-pre-line text-sm text-muted-foreground">{finding.evidence}</p>
      <label className="block text-sm">
        Finding type
        <select
          className={input}
          value={value.finding_type}
          onChange={(e) =>
            setValue({
              ...value,
              finding_type: e.target.value as FindingCommercial["finding_type"],
            })
          }
        >
          {["problem", "opportunity", "strength", "unknown"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      {(
        [
          ["reader_impact", "Reader impact"],
          ["business_impact", "Business opportunity"],
          ["evidence_limitations", "Evidence limitations"],
          ["proposed_next_action", "Next action"],
        ] as const
      ).map(([key, title]) => (
        <label key={key} className="mt-3 block text-sm">
          {title}
          <textarea
            className={input}
            value={value[key]}
            onChange={(e) => setValue({ ...value, [key]: e.target.value })}
          />
        </label>
      ))}
      <label className="mt-3 block text-sm">
        Retrieval dates (one YYYY-MM-DD per line)
        <textarea
          className={input}
          value={value.retrieval_dates.join("\n")}
          onChange={(e) =>
            setValue({ ...value, retrieval_dates: e.target.value.split("\n").filter(Boolean) })
          }
        />
      </label>
      <fieldset className="my-3">
        <legend>Documented evidence conditions</legend>
        {SIGNALS.map((kind) => {
          const signal = value.signals.find((s) => s.kind === kind);
          return (
            <div key={kind} className="my-2 text-sm">
              <label>
                <input
                  type="checkbox"
                  disabled={!finding.source_urls.length}
                  checked={!!signal}
                  onChange={(e) =>
                    setValue({
                      ...value,
                      signals: e.target.checked
                        ? [
                            ...value.signals,
                            {
                              kind,
                              source_url: finding.source_urls[0]!,
                              excerpt: finding.evidence,
                            },
                          ]
                        : value.signals.filter((s) => s.kind !== kind),
                    })
                  }
                />{" "}
                {kind.replaceAll("_", " ")}
              </label>
              {signal && (
                <div className="my-2 space-y-2">
                  <label className="block">
                    Supporting source
                    <select
                      className={input}
                      value={signal.source_url}
                      onChange={(e) =>
                        setValue({
                          ...value,
                          signals: value.signals.map((s) =>
                            s.kind === kind ? { ...s, source_url: e.target.value } : s,
                          ),
                        })
                      }
                    >
                      {finding.source_urls.map((url) => (
                        <option key={url}>{url}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    Exact excerpt from the evidence
                    <textarea
                      className={input}
                      value={signal.excerpt}
                      onChange={(e) =>
                        setValue({
                          ...value,
                          signals: value.signals.map((s) =>
                            s.kind === kind ? { ...s, excerpt: e.target.value } : s,
                          ),
                        })
                      }
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </fieldset>
      <button className={button} disabled={busy} onClick={() => onSave(value)}>
        Save finding impacts for review
      </button>
    </details>
  );
}
