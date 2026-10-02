import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CircleCheck, Trash2, Video } from "lucide-react";
import { GlassLoading } from "@/components/ui/glass-loading";
import { CORE_SERVICES, getCoreService } from "@/data/agency";
import { VIDEO_MAX_BYTES, VIDEO_TYPES, type ExpertTestimonial } from "@/lib/expert-testimonials";

const EMPTY_FORM = { client_name: "", client_role: "", quote: "", service_slug: "" };

function StatusBadge({ status }: { status: ExpertTestimonial["status"] }) {
  const tone = status === "approved" ? "paid" : status === "rejected" ? "overdue" : "pending";
  const label =
    status === "approved" ? "Live" : status === "rejected" ? "Not approved" : "In review";
  return <span className={`admin-status ${tone}`}>{label}</span>;
}

/** Expert-managed video testimonials shown on their public profile once approved. */
export function ExpertTestimonials() {
  const [items, setItems] = useState<ExpertTestimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "video">("");
  const [progress, setProgress] = useState(0);
  const [video, setVideo] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/expert/testimonials");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load your testimonials.");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your testimonials.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  function startAdd() {
    setForm(EMPTY_FORM);
    setVideo("");
    setNotice("");
    setError("");
    setShowForm(true);
  }

  async function uploadVideo(file: File) {
    setError("");
    if (!(VIDEO_TYPES as readonly string[]).includes(file.type)) {
      setError("Use an MP4, WebM or MOV video.");
      return;
    }
    if (file.size > VIDEO_MAX_BYTES) {
      setError("That video is over 50 MB. Trim or compress it, then try again.");
      return;
    }
    setBusy("video");
    setProgress(0);
    try {
      const response = await fetch("/api/expert/video-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not upload your video.");
      // XHR rather than fetch so a large upload can report progress.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", data.uploadUrl);
        xhr.setRequestHeader("content-type", file.type);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error("Could not upload your video."));
        xhr.onerror = () => reject(new Error("Could not upload your video."));
        xhr.send(file);
      });
      setVideo(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload your video.");
    } finally {
      setBusy("");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!video) {
      setError("Upload the video first.");
      return;
    }
    setBusy("save");
    setError("");
    try {
      const response = await fetch("/api/expert/testimonials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, video_url: video }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save this testimonial.");
      setShowForm(false);
      setNotice("Sent for review. It will appear on your profile once approved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this testimonial.");
    } finally {
      setBusy("");
    }
  }

  async function remove(item: ExpertTestimonial) {
    if (!window.confirm(`Delete the video from ${item.client_name}?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/expert/testimonials/${item.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete this testimonial.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this testimonial.");
    }
  }

  return (
    <section className="admin-content-panel" style={{ marginTop: "1.5rem" }}>
      <div className="admin-panel-heading" style={{ padding: "0 0 1.5rem" }}>
        <div>
          <h2>Testimonial videos</h2>
          <p>Short videos from happy clients. Each needs admin approval before it goes live.</p>
        </div>
        {!showForm && (
          <button className="admin-button admin-button-primary" onClick={startAdd}>
            Add testimonial video
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
            {video ? (
              <video
                src={video}
                muted
                playsInline
                preload="metadata"
                style={{ width: 96, height: 64, borderRadius: 12, objectFit: "cover" }}
              />
            ) : (
              <span className="admin-action-icon" style={{ width: 64, height: 64 }}>
                <Video size={20} />
              </span>
            )}
            <div>
              <strong>Video</strong>
              <p>
                {busy === "video"
                  ? `Uploading… ${progress}%`
                  : "MP4, WebM or MOV, up to 50 MB. A minute or two works best."}
              </p>
            </div>
            <label className="admin-button" style={{ cursor: "pointer" }}>
              {busy === "video" ? `${progress}%` : video ? "Replace" : "Upload"}
              <input
                type="file"
                accept={VIDEO_TYPES.join(",")}
                className="sr-only"
                disabled={!!busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadVideo(file);
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
              Client role (optional)
              <input
                maxLength={120}
                placeholder="e.g. Author of The Long Road"
                value={form.client_role}
                onChange={(e) => setForm((f) => ({ ...f, client_role: e.target.value }))}
              />
            </label>
          </div>
          <label>
            <span style={{ display: "flex", justifyContent: "space-between" }}>
              Short quote (optional)
              <small style={{ fontWeight: 400, opacity: 0.7 }}>{form.quote.length}/500</small>
            </span>
            <textarea
              rows={3}
              maxLength={500}
              value={form.quote}
              onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value }))}
            />
          </label>
          <label>
            Related service (optional)
            <select
              value={form.service_slug}
              onChange={(e) => setForm((f) => ({ ...f, service_slug: e.target.value }))}
            >
              <option value="">General</option>
              {CORE_SERVICES.map((service) => (
                <option key={service.slug} value={service.slug}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-button-row">
            <button className="admin-button admin-button-primary" disabled={!!busy || !video}>
              {busy === "save" ? "Saving…" : "Submit for review"}
            </button>
            <button type="button" className="admin-button" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <GlassLoading label="Loading your testimonials…" />
      ) : items.length === 0 ? (
        !showForm && (
          <div className="admin-empty">
            <h3>No testimonial videos yet</h3>
            <p>Add a short video from a client to build trust on your public profile.</p>
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
                      href={item.video_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.client_name}
                    </a>
                    <small>
                      {[item.client_role, getCoreService(item.service_slug ?? "")?.name]
                        .filter(Boolean)
                        .join(" · ") || "General"}
                    </small>
                  </td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>
                    <button
                      className="admin-icon-button text-destructive"
                      aria-label={`Delete video from ${item.client_name}`}
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
