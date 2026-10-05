import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CircleCheck, ImageUp, Star, Trash2 } from "lucide-react";
import { GlassLoading } from "@/components/ui/glass-loading";
import { REVIEW_PLATFORMS, platformLabel, type ExpertReview } from "@/lib/expert-reviews";

const EMPTY_FORM = {
  client_name: "",
  platform: "fiverr",
  rating: 5 as number | null,
  review_text: "",
  review_date: "",
};

function StatusBadge({ status }: { status: ExpertReview["status"] }) {
  const tone = status === "approved" ? "paid" : status === "rejected" ? "overdue" : "pending";
  const label =
    status === "approved" ? "Live" : status === "rejected" ? "Not approved" : "In review";
  return <span className={`admin-status ${tone}`}>{label}</span>;
}

/** Expert-managed client reviews, each backed by a screenshot of the original. */
export function ExpertReviews() {
  const [items, setItems] = useState<ExpertReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "image">("");
  const [screenshot, setScreenshot] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/expert/reviews");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load your reviews.");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your reviews.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function uploadScreenshot(file: File) {
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Use a PNG, JPG or WebP screenshot.");
      return;
    }
    setBusy("image");
    try {
      const response = await fetch("/api/expert/photo-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not upload your screenshot.");
      const put = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("Could not upload your screenshot.");
      setScreenshot(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload your screenshot.");
    } finally {
      setBusy("");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!screenshot) {
      setError("Upload a screenshot of the review first.");
      return;
    }
    setBusy("save");
    setError("");
    try {
      const response = await fetch("/api/expert/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, screenshot_url: screenshot }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save this review.");
      setShowForm(false);
      setNotice("Sent for review. It will appear on your profile once HQ360 verifies it.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this review.");
    } finally {
      setBusy("");
    }
  }

  async function remove(item: ExpertReview) {
    if (!window.confirm(`Delete the review from ${item.client_name}?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/expert/reviews/${item.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete this review.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this review.");
    }
  }

  return (
    <section className="admin-content-panel" style={{ marginTop: "1.5rem" }}>
      <div className="admin-panel-heading" style={{ padding: "0 0 1.5rem" }}>
        <div>
          <h2>Client reviews</h2>
          <p>
            Add reviews from Fiverr, Upwork or direct clients with a screenshot of the original.
            HQ360 verifies each one before it goes live.
          </p>
        </div>
        {!showForm && (
          <button
            className="admin-button admin-button-primary"
            onClick={() => {
              setForm(EMPTY_FORM);
              setScreenshot("");
              setNotice("");
              setError("");
              setShowForm(true);
            }}
          >
            Add client review
          </button>
        )}
      </div>
      {error && (
        <div className="admin-alert" role="alert">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {notice && (
        <div className="admin-notice" role="status">
          <CircleCheck size={18} />
          {notice}
        </div>
      )}

      {showForm && (
        <form className="admin-invoice-form" onSubmit={submit} style={{ marginBottom: "1.5rem" }}>
          <div className="admin-setup" style={{ marginBottom: 0 }}>
            {screenshot ? (
              <img
                src={screenshot}
                alt=""
                style={{ width: 96, height: 64, borderRadius: 12, objectFit: "cover" }}
              />
            ) : (
              <span className="admin-action-icon" style={{ width: 64, height: 64 }}>
                <ImageUp size={20} />
              </span>
            )}
            <div>
              <strong>Review screenshot</strong>
              <p>
                A clear capture of the original review. PNG, JPG or WebP. Visitors see it when they
                click “Verify review”.
              </p>
            </div>
            <label className="admin-button" style={{ cursor: "pointer" }}>
              {busy === "image" ? "Uploading…" : screenshot ? "Replace" : "Upload"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={!!busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadScreenshot(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="admin-form-grid">
            <label>
              Client name
              <input
                required
                minLength={2}
                maxLength={120}
                value={form.client_name}
                onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
              />
            </label>
            <label>
              Platform
              <select
                value={form.platform}
                onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
              >
                {REVIEW_PLATFORMS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="admin-form-label">Rating</span>
              <div className="admin-stars" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={form.rating === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    className={form.rating && n <= form.rating ? "on" : ""}
                    onClick={() => setForm((f) => ({ ...f, rating: n }))}
                  >
                    <Star size={20} />
                  </button>
                ))}
                <button
                  type="button"
                  className="admin-text-button"
                  onClick={() => setForm((f) => ({ ...f, rating: null }))}
                >
                  No rating
                </button>
              </div>
            </div>
            <label>
              Review date (optional)
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.review_date}
                onChange={(e) => setForm((f) => ({ ...f, review_date: e.target.value }))}
              />
            </label>
          </div>
          <label>
            <span style={{ display: "flex", justifyContent: "space-between" }}>
              Review text
              <small style={{ fontWeight: 400, opacity: 0.7 }}>
                {form.review_text.length}/1500
              </small>
            </span>
            <textarea
              required
              rows={4}
              maxLength={1500}
              placeholder="Copy the client's words exactly as they appear in the screenshot."
              value={form.review_text}
              onChange={(e) => setForm((f) => ({ ...f, review_text: e.target.value }))}
            />
          </label>
          <div className="admin-button-row">
            <button className="admin-button admin-button-primary" disabled={!!busy || !screenshot}>
              {busy === "save" ? "Saving…" : "Submit for verification"}
            </button>
            <button type="button" className="admin-button" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <GlassLoading label="Loading your reviews…" variant="table" rows={3} cols={3} />
      ) : items.length === 0 ? (
        !showForm && (
          <div className="admin-empty">
            <h3>No client reviews yet</h3>
            <p>Add a review with its screenshot so visitors can verify it on your profile.</p>
          </div>
        )
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <a
                      className="admin-invoice-name"
                      href={item.screenshot_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.client_name}
                    </a>
                    <small>
                      {platformLabel(item.platform)}
                      {item.rating ? ` · ${"★".repeat(item.rating)}` : ""}
                    </small>
                  </td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>
                    <button
                      className="admin-icon-button text-destructive"
                      aria-label={`Delete review from ${item.client_name}`}
                      onClick={() => void remove(item)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
