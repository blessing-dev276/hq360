import { useEffect, useState, type FormEvent } from "react";
import { invoiceBankDetails, type BankTransferDetails } from "@/lib/payments/bank-transfer";

export function BankDetailsEditor({
  details,
  onSave,
  disabled = false,
}: {
  details?: BankTransferDetails | null | undefined;
  onSave: (details: BankTransferDetails) => Promise<void>;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<BankTransferDetails>(() =>
    structuredClone(invoiceBankDetails(details)),
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setDraft(structuredClone(invoiceBankDetails(details))), [details]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(draft);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save bank details.");
    } finally {
      setSaving(false);
    }
  }
  const current = invoiceBankDetails(details);
  return (
    <section style={{ marginTop: 16 }}>
      <div
        className="admin-button-row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <strong>Bank details</strong>
        {!disabled && (
          <button
            type="button"
            className="admin-button"
            onClick={() => {
              setEditing(!editing);
              setError("");
            }}
          >
            {editing ? "Cancel" : "Edit bank details"}
          </button>
        )}
      </div>
      {editing ? (
        <form className="admin-invoice-form" onSubmit={save}>
          <label>
            Transfer instructions
            <textarea
              value={draft.instructions}
              maxLength={1000}
              required
              onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
            />
          </label>
          {draft.fields.map((field, index) => (
            <div key={index} className="flex gap-2" style={{ marginTop: 8 }}>
              <input
                aria-label={`Bank detail ${index + 1} label`}
                value={field.label}
                maxLength={60}
                required
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    fields: draft.fields.map((item, i) =>
                      i === index ? { ...item, label: e.target.value } : item,
                    ),
                  })
                }
              />
              <input
                aria-label={`Bank detail ${index + 1} value`}
                value={field.value}
                maxLength={300}
                required
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    fields: draft.fields.map((item, i) =>
                      i === index ? { ...item, value: e.target.value } : item,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="admin-button"
                disabled={draft.fields.length <= 2}
                onClick={() =>
                  setDraft({ ...draft, fields: draft.fields.filter((_, i) => i !== index) })
                }
              >
                Remove
              </button>
            </div>
          ))}
          <div className="admin-button-row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="admin-button"
              disabled={draft.fields.length >= 12}
              onClick={() =>
                setDraft({ ...draft, fields: [...draft.fields, { label: "", value: "" }] })
              }
            >
              Add field
            </button>
            <button type="submit" className="admin-button admin-button-primary" disabled={saving}>
              {saving ? "Saving…" : "Save bank details"}
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </form>
      ) : (
        <div style={{ marginTop: 8 }}>
          <p>{current.instructions}</p>
          <dl className="admin-invoice-details">
            {current.fields.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd style={{ overflowWrap: "anywhere" }}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
