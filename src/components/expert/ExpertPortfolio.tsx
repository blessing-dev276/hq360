import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CircleCheck, ImageUp, Pencil, Trash2 } from "lucide-react";
import { CORE_SERVICES, AUDIENCES } from "@/data/agency";

type PortfolioItem = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  external_link: string | null;
  service_slugs: string[];
  audience_slugs: string[];
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
};

const EMPTY_FORM = {
  title: "",
  description: "",
  external_link: "",
  service_slugs: [] as string[],
  audience_slugs: [] as string[],
};

function StatusBadge({ status }: { status: PortfolioItem["status"] }) {
  const label =
    status === "approved" ? "Live" : status === "rejected" ? "Rejected" : "Pending review";
  const tone = status === "approved" ? "paid" : status === "rejected" ? "overdue" : "pending";
  return <span className={`admin-status ${tone}`}>{label}</span>;
}

export function ExpertPortfolio() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "image">("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/expert/portfolio");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load your portfolio.");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your portfolio.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  function startAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImage("");
    setShowForm(true);
    setNotice("");
  }
  function startEdit(item: PortfolioItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description ?? "",
      external_link: item.external_link ?? "",
      service_slugs: item.service_slugs,
      audience_slugs: item.audience_slugs,
    });
    setImage(item.image_url ?? "");
    setShowForm(true);
    setNotice("");
  }

  async function uploadImage(file: File) {
    setBusy("image");
    setError("");
    try {
      const response = await fetch("/api/expert/photo-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not upload your image.");
      const put = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type, "x-upsert": "false" },
        body: file,
      });
      if (!put.ok) throw new Error("Could not upload your image.");
      setImage(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload your image.");
    } finally {
      setBusy("");
    }
  }

  function toggle(list: string[], slug: string): string[] {
    return list.includes(slug) ? list.filter((item) => item !== slug) : [...list, slug];
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        editingId ? `/api/expert/portfolio/${editingId}` : "/api/expert/portfolio",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...form, image_url: image }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save this item.");
      setShowForm(false);
      setNotice("Saved. It's queued for admin review before it shows on your public profile.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this item.");
    } finally {
      setBusy("");
    }
  }

  async function remove(item: PortfolioItem) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    setError("");
    try {
      const response = await fetch(`/api/expert/portfolio/${item.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete this item.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this item.");
    }
  }

  return (
    <section className="admin-content-panel" style={{ marginTop: "1.5rem" }}>
      <div className="admin-panel-heading" style={{ padding: "0 0 1.5rem" }}>
        <div>
          <h2>Portfolio</h2>
          <p>Each item needs admin approval before it shows on your public profile.</p>
        </div>
        {!showForm && (
          <button className="admin-button admin-button-primary" onClick={startAdd}>
            Add portfolio item
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
            {image ? (
              <img
                src={image}
                alt=""
                style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover" }}
              />
            ) : (
              <span className="admin-action-icon" style={{ width: 64, height: 64 }}>
                <ImageUp size={20} />
              </span>
            )}
            <div>
              <strong>Image</strong>
              <p>Optional. PNG, JPG or WebP.</p>
            </div>
            <label className="admin-button" style={{ cursor: "pointer" }}>
              {busy === "image" ? "Uploading…" : image ? "Replace" : "Upload"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={!!busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadImage(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          <label>
            Title
            <input
              required
              minLength={2}
              maxLength={150}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label>
            Description
            <textarea
              rows={4}
              maxLength={2000}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label>
            Link (optional)
            <input
              type="url"
              placeholder="https://"
              value={form.external_link}
              onChange={(e) => setForm((f) => ({ ...f, external_link: e.target.value }))}
            />
          </label>
          <div>
            <strong style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              Related services
            </strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
              {CORE_SERVICES.map((service) => (
                <label
                  key={service.slug}
                  className="admin-filters"
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                >
                  <input
                    type="checkbox"
                    checked={form.service_slugs.includes(service.slug)}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        service_slugs: toggle(f.service_slugs, service.slug),
                      }))
                    }
                  />
                  {service.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <strong style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              Related audiences
            </strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
              {AUDIENCES.map((audience) => (
                <label
                  key={audience.slug}
                  className="admin-filters"
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                >
                  <input
                    type="checkbox"
                    checked={form.audience_slugs.includes(audience.slug)}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        audience_slugs: toggle(f.audience_slugs, audience.slug),
                      }))
                    }
                  />
                  {audience.name}
                </label>
              ))}
            </div>
          </div>
          <div className="admin-button-row">
            <button className="admin-button admin-button-primary" disabled={!!busy}>
              {busy === "save" ? "Saving…" : editingId ? "Save changes" : "Submit for review"}
            </button>
            <button type="button" className="admin-button" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="admin-empty" role="status">
          Loading…
        </div>
      ) : items.length === 0 ? (
        !showForm && (
          <div className="admin-empty">
            <h3>No portfolio items yet</h3>
            <p>Add examples of your work to show on your public profile once approved.</p>
          </div>
        )
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Item</th>
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
                    <span className="admin-invoice-name">{item.title}</span>
                    {item.description && <small>{item.description.slice(0, 80)}</small>}
                  </td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>
                    <div className="admin-button-row">
                      <button className="admin-icon-button" onClick={() => startEdit(item)}>
                        <Pencil size={15} />
                      </button>
                      <button
                        className="admin-icon-button text-destructive"
                        onClick={() => void remove(item)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
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
