import { useEffect, useState, type FormEvent } from "react";
import { money } from "@/lib/payments/types";

export type BankPaymentTerms = {
  currency: "USD" | "EUR";
  amount_minor: number;
  bank_transfer_amount_minor: number | null;
};

export function BankPaymentTermsEditor({
  terms,
  editable,
  onSave,
}: {
  terms: BankPaymentTerms;
  editable: boolean;
  onSave: (terms: BankPaymentTerms) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [currency, setCurrency] = useState(terms.currency);
  const [amount, setAmount] = useState((terms.amount_minor / 100).toFixed(2));
  const [transferAmount, setTransferAmount] = useState(
    terms.bank_transfer_amount_minor ? (terms.bank_transfer_amount_minor / 100).toFixed(2) : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setCurrency(terms.currency);
    setAmount((terms.amount_minor / 100).toFixed(2));
    setTransferAmount(
      terms.bank_transfer_amount_minor ? (terms.bank_transfer_amount_minor / 100).toFixed(2) : "",
    );
  }, [terms.currency, terms.amount_minor, terms.bank_transfer_amount_minor]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const minor = Math.round(Number(amount) * 100);
    const transferMinor = currency === "USD" ? Math.round(Number(transferAmount) * 100) : null;
    if (
      !Number.isSafeInteger(minor) ||
      minor <= 0 ||
      (currency === "USD" &&
        (!Number.isSafeInteger(transferMinor) || !transferMinor || transferMinor <= 0))
    ) {
      setError("Enter a valid invoice amount and EUR transfer amount.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({ currency, amount_minor: minor, bank_transfer_amount_minor: transferMinor });
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save amount and currency.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section style={{ marginTop: 16 }}>
      <div
        className="admin-button-row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <strong>Invoice amount and currency</strong>
        {editable && (
          <button
            type="button"
            className="admin-button"
            onClick={() => {
              setEditing(!editing);
              setError("");
            }}
          >
            {editing ? "Cancel" : "Edit amount and currency"}
          </button>
        )}
      </div>
      {editing ? (
        <form className="admin-invoice-form" onSubmit={save}>
          <label>
            Invoice currency
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value as "USD" | "EUR")}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label>
            Invoice total
            <input
              type="number"
              min="0.01"
              max="100000000"
              step="0.01"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          {currency === "USD" && (
            <label>
              Agreed EUR transfer amount
              <input
                type="number"
                min="0.01"
                max="100000000"
                step="0.01"
                required
                value={transferAmount}
                onChange={(event) => setTransferAmount(event.target.value)}
              />
            </label>
          )}
          <p>
            Confirm the amount with the buyer before issuing the invoice. Changing the currency does
            not convert the amount automatically.
          </p>
          <button type="submit" className="admin-button admin-button-primary" disabled={busy}>
            {busy ? "Saving…" : "Save amount and currency"}
          </button>
          {error && <p role="alert">{error}</p>}
        </form>
      ) : (
        <p style={{ marginTop: 8 }}>
          {money(terms.amount_minor, terms.currency)}
          {terms.currency === "USD" && terms.bank_transfer_amount_minor
            ? ` · Pay ${money(terms.bank_transfer_amount_minor, "EUR")}`
            : ""}
        </p>
      )}
    </section>
  );
}
