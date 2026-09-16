import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { CAPABILITIES } from "@/data/capabilities";
import { INDUSTRIES } from "@/data/industries";
import { uploadAdminMedia, type AdminBucket } from "@/lib/admin-upload";
import type { SerializedCaseStudy } from "@/lib/case-study-shape";
import { AuthorAuditAdmin } from "@/components/admin/AuthorAuditAdmin";

/* ------------------------------------------------------------------ types */

type MediaType = "image" | "video";

type Item = {
  id: string;
  title: string;
  description: string | null;
  media_type: MediaType;
  media_url: string;
  thumbnail_url: string | null;
  capability_slug: string;
  industry_slug: string | null;
  external_link: string | null;
  sort_order: number;
  published: boolean;
};

type Draft = {
  id?: string;
  title: string;
  description: string;
  mediaType: MediaType;
  mediaUrl: string;
  thumbnailUrl: string;
  capabilitySlug: string;
  industrySlug: string;
  externalLink: string;
  published: boolean;
};

const CAPABILITY_OPTIONS = CAPABILITIES.map((c) => ({ value: c.slug, label: c.name }));
const INDUSTRY_OPTIONS = INDUSTRIES.map((i) => ({ value: i.slug, label: i.shortName }));

function industryName(slug: string | null) {
  if (!slug) return "Unassigned";
  return INDUSTRIES.find((i) => i.slug === slug)?.shortName ?? slug;
}

const emptyDraft: Draft = {
  title: "",
  description: "",
  mediaType: "image",
  mediaUrl: "",
  thumbnailUrl: "",
  capabilitySlug: CAPABILITY_OPTIONS[0]?.value ?? "",
  industrySlug: "",
  externalLink: "",
  published: true,
};

/* --------------------------------------------------------------- fetchers */

async function api<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const isForm = init?.body instanceof FormData;
  const res = await fetch(url, {
    ...init,
    ...(isForm ? {} : { headers: { "content-type": "application/json" } }),
  });
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

function uploadErrorMessage(err: unknown): string {
  const code = err instanceof Error ? err.message : "";
  if (code === "too_large") return "File is over 50 MB. Host it elsewhere and paste the URL.";
  if (code === "unsupported_type") return "Unsupported file type.";
  return "Upload failed. Try again, or paste a URL.";
}

/** Small file picker that hands back a hosted URL. */
function UploadField({
  bucket,
  accept,
  onUploaded,
  hint,
}: {
  bucket: AdminBucket;
  accept: string;
  onUploaded: (url: string, mediaType: "image" | "video") => void;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <input
        type="file"
        accept={accept}
        disabled={uploading}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploading(true);
          setError("");
          try {
            const { url, mediaType } = await uploadAdminMedia(file, bucket);
            onUploaded(url, mediaType);
          } catch (err) {
            setError(uploadErrorMessage(err));
          }
          setUploading(false);
          e.target.value = "";
        }}
        className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground"
      />
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
      {uploading ? <p className="mt-2 text-sm text-brand">Uploading…</p> : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------- root */

type Tab = "work" | "team" | "testimonials" | "audits";
/** "Work" merges what used to be two separate tabs (case studies + the
 * lightweight service portfolio) — both are "work we've done", just at
 * different depths, so they live under one roof with a sub-switcher. */
type WorkView = "cases" | "gallery";

const TAB_TITLE: Record<Tab, string> = {
  work: "Work",
  team: "Team",
  testimonials: "Testimonials",
  audits: "Audits",
};

const input =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AdminApp() {
  const [tab, setTab] = useState<Tab>("work");
  const [workView, setWorkView] = useState<WorkView>("cases");

  return (
    <div className="min-h-[70vh] bg-secondary/40">
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
            HQ360 admin
          </p>
          <h1 className="mt-1 font-display text-2xl">{TAB_TITLE[tab]}</h1>
        </div>

        <div className="mt-6 flex gap-1 rounded-full border border-border bg-card p-1 text-sm">
          {(["work", "team", "testimonials", "audits"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-4 py-1.5 font-medium capitalize transition",
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "work" ? (
          <div className="mt-4 flex gap-1 text-sm">
            {(
              [
                { id: "cases", label: "Case studies" },
                { id: "gallery", label: "Quick gallery items" },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setWorkView(v.id)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 font-medium transition",
                  workView === v.id
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-8">
          {tab === "work" ? (
            workView === "cases" ? (
              <CaseStudyDashboard />
            ) : (
              <PortfolioDashboard />
            )
          ) : tab === "team" ? (
            <TeamDashboard />
          ) : tab === "testimonials" ? (
            <TestimonialDashboard />
          ) : (
            <AuthorAuditAdmin />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------- portfolio dashboard */

function PortfolioDashboard() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [view, setView] = useState<"grouped" | "flat">("grouped");
  const dragId = useRef<string | null>(null);

  const load = useCallback(async () => {
    const { status, body } = await api<{ ok: boolean; items: Item[] }>("/api/admin/portfolio");
    if (status === 200 && body.ok) {
      setItems(body.items);
      setLoadError("");
    } else {
      setLoadError(
        status === 503
          ? "Storage is not connected yet (missing Supabase service role key)."
          : "Could not load portfolio items.",
      );
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const list = items ?? [];
    const known = CAPABILITY_OPTIONS.map((c) => ({
      slug: c.value,
      label: c.label,
      items: list.filter((i) => i.capability_slug === c.value),
    }));
    const otherSlugs = [
      ...new Set(
        list
          .filter((i) => !CAPABILITY_OPTIONS.some((c) => c.value === i.capability_slug))
          .map((i) => i.capability_slug),
      ),
    ];
    const other = otherSlugs.map((slug) => ({
      slug,
      label: slug,
      items: list.filter((i) => i.capability_slug === slug),
    }));
    return [...known, ...other].filter((g) => g.items.length > 0);
  }, [items]);

  const persistOrder = useCallback(async (ordered: Item[]) => {
    setItems(ordered);
    await api("/api/admin/portfolio/reorder", {
      method: "POST",
      body: JSON.stringify({ ids: ordered.map((i) => i.id) }),
    });
  }, []);

  /** Reorder within a capability group, keeping the other groups' order stable. */
  const reorderWithinGroup = useCallback(
    (groupSlug: string, fromId: string, toId: string) => {
      if (!items || fromId === toId) return;
      const group = items.filter((i) => i.capability_slug === groupSlug);
      const from = group.findIndex((i) => i.id === fromId);
      const to = group.findIndex((i) => i.id === toId);
      if (from < 0 || to < 0) return;
      const next = [...group];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      const rebuilt: Item[] = [];
      const seen = new Set<string>();
      for (const it of items) {
        if (it.capability_slug === groupSlug) {
          if (!seen.has(groupSlug)) {
            rebuilt.push(...next);
            seen.add(groupSlug);
          }
        } else {
          rebuilt.push(it);
        }
      }
      void persistOrder(rebuilt);
    },
    [items, persistOrder],
  );

  const move = useCallback(
    (groupSlug: string, id: string, dir: -1 | 1) => {
      if (!items) return;
      const group = items.filter((i) => i.capability_slug === groupSlug);
      const idx = group.findIndex((i) => i.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= group.length) return;
      reorderWithinGroup(groupSlug, id, group[target]!.id);
    },
    [items, reorderWithinGroup],
  );

  /** Reorder across the whole flat list (ignores capability grouping). */
  const reorderFlat = useCallback(
    (fromId: string, toId: string) => {
      if (!items || fromId === toId) return;
      const from = items.findIndex((i) => i.id === fromId);
      const to = items.findIndex((i) => i.id === toId);
      if (from < 0 || to < 0) return;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      void persistOrder(next);
    },
    [items, persistOrder],
  );

  const moveFlat = useCallback(
    (id: string, dir: -1 | 1) => {
      if (!items) return;
      const idx = items.findIndex((i) => i.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= items.length) return;
      reorderFlat(id, items[target]!.id);
    },
    [items, reorderFlat],
  );

  async function saveDraft(draft: Draft) {
    const payload = {
      title: draft.title,
      description: draft.description,
      mediaType: draft.mediaType,
      mediaUrl: draft.mediaUrl,
      thumbnailUrl: draft.thumbnailUrl,
      capabilitySlug: draft.capabilitySlug,
      industrySlug: draft.industrySlug,
      externalLink: draft.externalLink,
      published: draft.published,
    };
    const { status, body } = draft.id
      ? await api<{ ok: boolean }>(`/api/admin/portfolio/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      : await api<{ ok: boolean }>("/api/admin/portfolio", {
          method: "POST",
          body: JSON.stringify(payload),
        });
    if (status === 200 && body.ok) {
      setEditing(null);
      await load();
      return true;
    }
    return false;
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this portfolio item?")) return;
    await api(`/api/admin/portfolio/${id}`, { method: "DELETE" });
    await load();
  }

  async function togglePublish(it: Item) {
    await api(`/api/admin/portfolio/${it.id}`, {
      method: "PATCH",
      body: JSON.stringify({ published: !it.published }),
    });
    await load();
  }

  return (
    <div className="space-y-8">
      <ItemForm
        key={editing?.id ?? "new"}
        initial={editing ?? emptyDraft}
        onCancel={editing ? () => setEditing(null) : undefined}
        onSave={saveDraft}
      />

      {loadError ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {loadError}
        </p>
      ) : null}

      {items && items.length > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {items.length} uploaded {items.length === 1 ? "item" : "items"}
          </p>
          <div className="flex rounded-full border border-border bg-card p-0.5 text-xs">
            {(["grouped", "flat"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded-full px-3 py-1 font-medium",
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {v === "grouped" ? "By category" : "All items"}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {items === null ? (
        <p className="text-sm text-muted-foreground">Loading items…</p>
      ) : items.length === 0 && !loadError ? (
        <p className="text-sm text-muted-foreground">No portfolio items yet. Add one above.</p>
      ) : view === "flat" ? (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li
              key={it.id}
              draggable
              onDragStart={() => (dragId.current = it.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId.current) reorderFlat(dragId.current, it.id);
                dragId.current = null;
              }}
            >
              <ItemRow
                item={it}
                first={i === 0}
                last={i === items.length - 1}
                showCategory
                onUp={() => moveFlat(it.id, -1)}
                onDown={() => moveFlat(it.id, 1)}
                onEdit={() => setEditing(toDraft(it))}
                onDelete={() => void remove(it.id)}
                onTogglePublish={() => void togglePublish(it)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.slug}>
              <h2 className="text-sm font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {group.label} <span className="text-foreground/40">({group.items.length})</span>
              </h2>
              <ul className="mt-3 space-y-2">
                {group.items.map((it, i) => (
                  <li
                    key={it.id}
                    draggable
                    onDragStart={() => (dragId.current = it.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragId.current) reorderWithinGroup(group.slug, dragId.current, it.id);
                      dragId.current = null;
                    }}
                  >
                    <ItemRow
                      item={it}
                      first={i === 0}
                      last={i === group.items.length - 1}
                      onUp={() => move(group.slug, it.id, -1)}
                      onDown={() => move(group.slug, it.id, 1)}
                      onEdit={() => setEditing(toDraft(it))}
                      onDelete={() => void remove(it.id)}
                      onTogglePublish={() => void togglePublish(it)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function toDraft(it: Item): Draft {
  return {
    id: it.id,
    title: it.title,
    description: it.description ?? "",
    mediaType: it.media_type,
    mediaUrl: it.media_url,
    thumbnailUrl: it.thumbnail_url ?? "",
    capabilitySlug: it.capability_slug,
    industrySlug: it.industry_slug ?? "",
    externalLink: it.external_link ?? "",
    published: it.published,
  };
}

/* --------------------------------------------------------------- item row */

function ItemRow({
  item,
  first,
  last,
  showCategory,
  onUp,
  onDown,
  onEdit,
  onDelete,
  onTogglePublish,
}: {
  item: Item;
  first: boolean;
  last: boolean;
  showCategory?: boolean;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
}) {
  const categoryLabel =
    CAPABILITY_OPTIONS.find((c) => c.value === item.capability_slug)?.label ?? item.capability_slug;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <span
        className="cursor-grab select-none px-1 text-muted-foreground"
        title="Drag to reorder"
        aria-hidden="true"
      >
        ⠿
      </span>
      <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
        {item.media_type === "video" ? (
          <video
            src={item.media_url}
            poster={item.thumbnail_url ?? undefined}
            muted
            playsInline
            className="size-full object-cover"
          />
        ) : (
          <img src={item.media_url} alt={item.title} className="size-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {showCategory ? (
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[oklch(0.42_0.16_42)]">
              {categoryLabel}
            </span>
          ) : null}
          <span className="rounded-full bg-secondary px-2 py-0.5">
            {industryName(item.industry_slug)}
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 capitalize">
            {item.media_type}
          </span>
          <button
            type="button"
            onClick={onTogglePublish}
            className={cn(
              "rounded-full px-2 py-0.5",
              item.published
                ? "bg-brand-soft text-[oklch(0.42_0.16_42)]"
                : "bg-secondary text-muted-foreground line-through",
            )}
          >
            {item.published ? "Published" : "Hidden"}
          </button>
        </p>
      </div>
      <RowControls
        first={first}
        last={last}
        onUp={onUp}
        onDown={onDown}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

function RowControls({
  first,
  last,
  onUp,
  onDown,
  onEdit,
  onDelete,
}: {
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onUp}
        disabled={first}
        aria-label="Move up"
        className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={last}
        aria-label="Move down"
        className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-30"
      >
        ↓
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:border-brand hover:text-brand"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-destructive hover:border-destructive"
      >
        Delete
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------- form */

function ItemForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Draft;
  onSave: (d: Draft) => Promise<boolean>;
  onCancel?: (() => void) | undefined;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [mode, setMode] = useState<"upload" | "url">(initial.mediaUrl ? "url" : "upload");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { url, mediaType } = await uploadAdminMedia(file, "portfolio");
      setDraft((d) => ({ ...d, mediaUrl: url, mediaType }));
    } catch (err) {
      setError(uploadErrorMessage(err));
    }
    setUploading(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!draft.title.trim()) return setError("Title is required.");
    if (!draft.mediaUrl.trim()) return setError("Upload a file or paste a media URL.");
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (!ok) setError("Could not save. Check the fields and try again.");
    else if (!draft.id) setDraft(emptyDraft);
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">{draft.id ? "Edit item" : "Add portfolio item"}</h2>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input
            className={cn(input, "mt-1.5")}
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">External link (optional)</span>
          <input
            className={cn(input, "mt-1.5")}
            placeholder="https://…"
            value={draft.externalLink}
            onChange={(e) => set("externalLink", e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Service category</span>
          <select
            className={cn(input, "mt-1.5")}
            value={draft.capabilitySlug}
            onChange={(e) => set("capabilitySlug", e.target.value)}
          >
            {CAPABILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Industry</span>
          <select
            className={cn(input, "mt-1.5")}
            value={draft.industrySlug}
            onChange={(e) => set("industrySlug", e.target.value)}
          >
            <option value="">— Unassigned —</option>
            {INDUSTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium">Description (optional)</span>
        <textarea
          rows={2}
          className={cn(input, "mt-1.5 resize-y")}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>

      {/* Media */}
      <div className="mt-4 rounded-xl border border-border bg-background p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Media</span>
          <div className="ml-auto flex rounded-full border border-border p-0.5 text-xs">
            {(["upload", "url"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-full px-3 py-1 font-medium capitalize",
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {m === "url" ? "Paste URL" : "Upload"}
              </button>
            ))}
          </div>
        </div>

        {mode === "upload" ? (
          <div className="mt-3">
            <input
              type="file"
              accept="image/*,video/*"
              onChange={onFile}
              className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Images or video up to 50 MB. Larger videos: host elsewhere and paste the URL.
            </p>
            {uploading ? <p className="mt-2 text-sm text-brand">Uploading…</p> : null}
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_9rem]">
            <input
              className={input}
              placeholder="https://… (image or video URL)"
              value={draft.mediaUrl}
              onChange={(e) => set("mediaUrl", e.target.value)}
            />
            <select
              className={input}
              value={draft.mediaType}
              onChange={(e) => set("mediaType", e.target.value as MediaType)}
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>
        )}

        {draft.mediaType === "video" ? (
          <input
            className={cn(input, "mt-3")}
            placeholder="Thumbnail / poster image URL (optional)"
            value={draft.thumbnailUrl}
            onChange={(e) => set("thumbnailUrl", e.target.value)}
          />
        ) : null}

        {draft.mediaUrl ? (
          <div className="mt-3 flex items-center gap-3">
            <div className="size-20 overflow-hidden rounded-lg border border-border bg-secondary">
              {draft.mediaType === "video" ? (
                <video
                  src={draft.mediaUrl}
                  poster={draft.thumbnailUrl || undefined}
                  muted
                  playsInline
                  className="size-full object-cover"
                />
              ) : (
                <img
                  src={draft.mediaUrl}
                  alt={draft.title || "Preview"}
                  className="size-full object-cover"
                />
              )}
            </div>
            <span className="truncate text-xs text-muted-foreground">{draft.mediaUrl}</span>
          </div>
        ) : null}
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.published}
          onChange={(e) => set("published", e.target.checked)}
          className="size-4 accent-[var(--brand)]"
        />
        Published (visible on the public site)
      </label>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <button
        type="submit"
        disabled={saving || uploading}
        className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-70"
      >
        {saving ? "Saving…" : draft.id ? "Save changes" : "Add item"}
      </button>
    </form>
  );
}

/* --------------------------------------------------------- team dashboard */

type Member = {
  id: string;
  name: string;
  title: string;
  image_url: string | null;
  blurb: string | null;
  sort_order: number;
  published: boolean;
};

type MemberDraft = {
  id?: string;
  name: string;
  title: string;
  imageUrl: string;
  blurb: string;
  published: boolean;
};

const emptyMemberDraft: MemberDraft = {
  name: "",
  title: "",
  imageUrl: "",
  blurb: "",
  published: true,
};

function TeamDashboard() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<MemberDraft | null>(null);
  const dragId = useRef<string | null>(null);

  const load = useCallback(async () => {
    const { status, body } = await api<{ ok: boolean; members: Member[] }>("/api/admin/team");
    if (status === 200 && body.ok) {
      setMembers(body.members);
      setLoadError("");
    } else {
      setLoadError(
        status === 503
          ? "Storage is not connected yet (missing Supabase service role key)."
          : "Could not load team members.",
      );
      setMembers([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persistOrder = useCallback(async (ordered: Member[]) => {
    setMembers(ordered);
    await api("/api/admin/team/reorder", {
      method: "POST",
      body: JSON.stringify({ ids: ordered.map((m) => m.id) }),
    });
  }, []);

  const reorder = useCallback(
    (fromId: string, toId: string) => {
      if (!members || fromId === toId) return;
      const from = members.findIndex((m) => m.id === fromId);
      const to = members.findIndex((m) => m.id === toId);
      if (from < 0 || to < 0) return;
      const next = [...members];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      void persistOrder(next);
    },
    [members, persistOrder],
  );

  const move = useCallback(
    (id: string, dir: -1 | 1) => {
      if (!members) return;
      const idx = members.findIndex((m) => m.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= members.length) return;
      reorder(id, members[target]!.id);
    },
    [members, reorder],
  );

  async function saveDraft(draft: MemberDraft) {
    const payload = {
      name: draft.name,
      title: draft.title,
      imageUrl: draft.imageUrl,
      blurb: draft.blurb,
      published: draft.published,
    };
    const { status, body } = draft.id
      ? await api<{ ok: boolean }>(`/api/admin/team/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      : await api<{ ok: boolean }>("/api/admin/team", {
          method: "POST",
          body: JSON.stringify(payload),
        });
    if (status === 200 && body.ok) {
      setEditing(null);
      await load();
      return true;
    }
    return false;
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this team member?")) return;
    await api(`/api/admin/team/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-8">
      <MemberForm
        key={editing?.id ?? "new"}
        initial={editing ?? emptyMemberDraft}
        onCancel={editing ? () => setEditing(null) : undefined}
        onSave={saveDraft}
      />

      {loadError ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {loadError}
        </p>
      ) : null}

      {members === null ? (
        <p className="text-sm text-muted-foreground">Loading team…</p>
      ) : members.length === 0 && !loadError ? (
        <p className="text-sm text-muted-foreground">No team members yet. Add one above.</p>
      ) : (
        <ul className="space-y-2">
          {members.map((m, i) => (
            <li
              key={m.id}
              draggable
              onDragStart={() => (dragId.current = m.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId.current) reorder(dragId.current, m.id);
                dragId.current = null;
              }}
            >
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <span
                  className="cursor-grab select-none px-1 text-muted-foreground"
                  title="Drag to reorder"
                  aria-hidden="true"
                >
                  ⠿
                </span>
                <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
                  {m.image_url ? (
                    <img src={m.image_url} alt={m.name} className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center text-sm font-semibold text-muted-foreground">
                      {initialsFor(m.name)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="truncate">{m.title}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        await api(`/api/admin/team/${m.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ published: !m.published }),
                        });
                        await load();
                      }}
                      className={cn(
                        "rounded-full px-2 py-0.5",
                        m.published
                          ? "bg-brand-soft text-[oklch(0.42_0.16_42)]"
                          : "bg-secondary text-muted-foreground line-through",
                      )}
                    >
                      {m.published ? "Published" : "Hidden"}
                    </button>
                  </p>
                </div>
                <RowControls
                  first={i === 0}
                  last={i === members.length - 1}
                  onUp={() => move(m.id, -1)}
                  onDown={() => move(m.id, 1)}
                  onEdit={() => setEditing(toMemberDraft(m))}
                  onDelete={() => void remove(m.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function initialsFor(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

function toMemberDraft(m: Member): MemberDraft {
  return {
    id: m.id,
    name: m.name,
    title: m.title,
    imageUrl: m.image_url ?? "",
    blurb: m.blurb ?? "",
    published: m.published,
  };
}

function MemberForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: MemberDraft;
  onSave: (d: MemberDraft) => Promise<boolean>;
  onCancel?: (() => void) | undefined;
}) {
  const [draft, setDraft] = useState<MemberDraft>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof MemberDraft>(k: K, v: MemberDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { url } = await uploadAdminMedia(file, "team");
      set("imageUrl", url);
    } catch (err) {
      setError(uploadErrorMessage(err));
    }
    setUploading(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!draft.name.trim()) return setError("Name is required.");
    if (!draft.title.trim()) return setError("Title is required.");
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (!ok) setError("Could not save. Try again.");
    else if (!draft.id) setDraft(emptyMemberDraft);
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">{draft.id ? "Edit member" : "Add team member"}</h2>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input
            className={cn(input, "mt-1.5")}
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input
            className={cn(input, "mt-1.5")}
            placeholder="e.g. Brand & Design Lead"
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-background p-4">
        <span className="text-sm font-medium">Portrait</span>
        <div className="mt-3 flex items-center gap-4">
          <div className="size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
            {draft.imageUrl ? (
              <img
                src={draft.imageUrl}
                alt={draft.name || "Preview"}
                className="size-full object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center text-sm font-semibold text-muted-foreground">
                {draft.name ? initialsFor(draft.name) : "—"}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={onFile}
              className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground"
            />
            <input
              className={cn(input, "mt-2")}
              placeholder="…or paste an image URL"
              value={draft.imageUrl}
              onChange={(e) => set("imageUrl", e.target.value)}
            />
            {uploading ? <p className="mt-2 text-sm text-brand">Uploading…</p> : null}
          </div>
        </div>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium">What they do</span>
        <textarea
          rows={2}
          maxLength={400}
          className={cn(input, "mt-1.5 resize-y")}
          placeholder="One line shown on the flip side of their team card, e.g. “Owns paid and lifecycle — the path from spend to qualified pipeline.”"
          value={draft.blurb}
          onChange={(e) => set("blurb", e.target.value)}
        />
      </label>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.published}
          onChange={(e) => set("published", e.target.checked)}
          className="size-4 accent-[var(--brand)]"
        />
        Published (visible on the public site)
      </label>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <button
        type="submit"
        disabled={saving || uploading}
        className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-70"
      >
        {saving ? "Saving…" : draft.id ? "Save changes" : "Add member"}
      </button>
    </form>
  );
}

/* ----------------------------------------------------- case study dashboard */

const CS_INDUSTRY_OPTIONS = Array.from(new Set(INDUSTRIES.map((i) => i.shortName))).sort();

type MetricRow = { label: string; value: string; note: string };
type CSMediaRow = { src: string; alt: string; caption: string; type: MediaType };

type CSDraft = {
  id?: string;
  slug: string;
  slugLocked: boolean;
  status: "verified" | "sample";
  title: string;
  client: string;
  industry: string;
  capabilities: string[];
  summary: string;
  challenge: string;
  approach: string;
  deliverables: string;
  outcome: string;
  metrics: MetricRow[];
  testimonialOn: boolean;
  tQuote: string;
  tName: string;
  tRole: string;
  media: CSMediaRow[];
  published: boolean;
};

const emptyCSDraft: CSDraft = {
  slug: "",
  slugLocked: false,
  status: "sample",
  title: "",
  client: "",
  industry: "",
  capabilities: [],
  summary: "",
  challenge: "",
  approach: "",
  deliverables: "",
  outcome: "",
  metrics: [],
  testimonialOn: false,
  tQuote: "",
  tName: "",
  tRole: "",
  media: [],
  published: true,
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function csToDraft(it: SerializedCaseStudy): CSDraft {
  return {
    id: it.id,
    slug: it.slug,
    slugLocked: true,
    status: it.status,
    title: it.title,
    client: it.client,
    industry: it.industry,
    capabilities: it.capabilities,
    summary: it.summary,
    challenge: it.challenge,
    approach: it.approach.join("\n"),
    deliverables: it.deliverables.join("\n"),
    outcome: it.outcome,
    metrics: it.metrics.map((m) => ({ label: m.label, value: m.value, note: m.note ?? "" })),
    testimonialOn: Boolean(it.testimonial),
    tQuote: it.testimonial?.quote ?? "",
    tName: it.testimonial?.name ?? "",
    tRole: it.testimonial?.role ?? "",
    media: it.media.map((m) => ({
      src: m.src,
      alt: m.alt ?? "",
      caption: m.caption ?? "",
      type: m.type ?? "image",
    })),
    published: it.published,
  };
}

function csDraftToPayload(d: CSDraft) {
  const lines = (s: string) =>
    s
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  return {
    slug: (d.slug || slugify(d.title)).trim(),
    status: d.status,
    title: d.title.trim(),
    client: d.client.trim(),
    industry: d.industry.trim(),
    capabilities: d.capabilities,
    summary: d.summary.trim(),
    challenge: d.challenge.trim(),
    approach: lines(d.approach),
    deliverables: lines(d.deliverables),
    outcome: d.outcome.trim(),
    metrics: d.metrics
      .filter((m) => m.label.trim() && m.value.trim())
      .map((m) => ({ label: m.label.trim(), value: m.value.trim(), note: m.note.trim() })),
    testimonial:
      d.testimonialOn && d.tQuote.trim()
        ? { quote: d.tQuote.trim(), name: d.tName.trim(), role: d.tRole.trim() }
        : null,
    media: d.media
      .filter((m) => m.src.trim())
      .map((m) => ({
        src: m.src.trim(),
        alt: m.alt.trim(),
        caption: m.caption.trim(),
        type: m.type,
      })),
    published: d.published,
  };
}

function CaseStudyDashboard() {
  const [items, setItems] = useState<SerializedCaseStudy[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<CSDraft | null>(null);
  const dragId = useRef<string | null>(null);

  const load = useCallback(async () => {
    const { status, body } = await api<{ ok: boolean; items: SerializedCaseStudy[] }>(
      "/api/admin/case-studies",
    );
    if (status === 200 && body.ok) {
      setItems(body.items);
      setLoadError("");
    } else {
      setLoadError(
        status === 503
          ? "Storage is not connected yet (missing Supabase service role key)."
          : "Could not load case studies.",
      );
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persistOrder = useCallback(async (ordered: SerializedCaseStudy[]) => {
    setItems(ordered);
    await api("/api/admin/case-studies/reorder", {
      method: "POST",
      body: JSON.stringify({ ids: ordered.map((i) => i.id) }),
    });
  }, []);

  const reorder = useCallback(
    (fromId: string, toId: string) => {
      if (!items || fromId === toId) return;
      const from = items.findIndex((i) => i.id === fromId);
      const to = items.findIndex((i) => i.id === toId);
      if (from < 0 || to < 0) return;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      void persistOrder(next);
    },
    [items, persistOrder],
  );

  const move = useCallback(
    (id: string, dir: -1 | 1) => {
      if (!items) return;
      const idx = items.findIndex((i) => i.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= items.length) return;
      reorder(id, items[target]!.id);
    },
    [items, reorder],
  );

  async function saveDraft(draft: CSDraft): Promise<string | true> {
    const payload = csDraftToPayload(draft);
    if (!payload.title) return "Title is required.";
    if (!payload.slug) return "Slug is required.";
    const { status, body } = draft.id
      ? await api<{ ok: boolean; error?: string }>(`/api/admin/case-studies/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      : await api<{ ok: boolean; error?: string }>("/api/admin/case-studies", {
          method: "POST",
          body: JSON.stringify(payload),
        });
    if (status === 200 && body.ok) {
      setEditing(null);
      await load();
      return true;
    }
    if (status === 409 || body.error === "duplicate_slug")
      return "That slug is already used by another case study.";
    return "Could not save. Check the fields and try again.";
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this case study?")) return;
    await api(`/api/admin/case-studies/${id}`, { method: "DELETE" });
    await load();
  }

  async function togglePublish(it: SerializedCaseStudy) {
    await api(`/api/admin/case-studies/${it.id}`, {
      method: "PATCH",
      body: JSON.stringify({ published: !it.published }),
    });
    await load();
  }

  return (
    <div className="space-y-8">
      <CaseStudyForm
        key={editing?.id ?? "new"}
        initial={editing ?? emptyCSDraft}
        onCancel={editing ? () => setEditing(null) : undefined}
        onSave={saveDraft}
      />

      {loadError ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {loadError}
        </p>
      ) : null}

      {items === null ? (
        <p className="text-sm text-muted-foreground">Loading case studies…</p>
      ) : items.length === 0 && !loadError ? (
        <p className="text-sm text-muted-foreground">No case studies yet. Add one above.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li
              key={it.id}
              draggable
              onDragStart={() => (dragId.current = it.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId.current) reorder(dragId.current, it.id);
                dragId.current = null;
              }}
            >
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <span
                  className="cursor-grab px-1 text-muted-foreground select-none"
                  title="Drag to reorder"
                  aria-hidden="true"
                >
                  ⠿
                </span>
                <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
                  {it.media[0] ? (
                    it.media[0].type === "video" ? (
                      <video
                        src={it.media[0].src}
                        muted
                        playsInline
                        className="size-full object-cover"
                      />
                    ) : (
                      <img
                        src={it.media[0].src}
                        alt={it.media[0].alt || it.title}
                        className="size-full object-cover"
                      />
                    )
                  ) : (
                    <span className="flex size-full items-center justify-center text-[0.6rem] text-muted-foreground">
                      No media
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="rounded-full bg-secondary px-2 py-0.5">/work/{it.slug}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 capitalize">
                      {it.status}
                    </span>
                    {it.industry ? (
                      <span className="rounded-full bg-secondary px-2 py-0.5">{it.industry}</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void togglePublish(it)}
                      className={cn(
                        "rounded-full px-2 py-0.5",
                        it.published
                          ? "bg-brand-soft text-[oklch(0.42_0.16_42)]"
                          : "bg-secondary text-muted-foreground line-through",
                      )}
                    >
                      {it.published ? "Published" : "Hidden"}
                    </button>
                  </p>
                </div>
                <RowControls
                  first={i === 0}
                  last={i === items.length - 1}
                  onUp={() => move(it.id, -1)}
                  onDown={() => move(it.id, 1)}
                  onEdit={() => setEditing(csToDraft(it))}
                  onDelete={() => void remove(it.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CaseStudyForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: CSDraft;
  onSave: (d: CSDraft) => Promise<string | true>;
  onCancel?: (() => void) | undefined;
}) {
  const [draft, setDraft] = useState<CSDraft>(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof CSDraft>(k: K, v: CSDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function setTitle(v: string) {
    setDraft((d) => ({ ...d, title: v, slug: d.slugLocked ? d.slug : slugify(v) }));
  }

  function toggleCapability(slug: string) {
    setDraft((d) => ({
      ...d,
      capabilities: d.capabilities.includes(slug)
        ? d.capabilities.filter((s) => s !== slug)
        : [...d.capabilities, slug],
    }));
  }

  function setMetric(i: number, patch: Partial<MetricRow>) {
    setDraft((d) => ({
      ...d,
      metrics: d.metrics.map((m, idx) => (idx === i ? { ...m, ...patch } : m)),
    }));
  }
  function setMediaRow(i: number, patch: Partial<CSMediaRow>) {
    setDraft((d) => ({
      ...d,
      media: d.media.map((m, idx) => (idx === i ? { ...m, ...patch } : m)),
    }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!draft.title.trim()) return setError("Title is required.");
    setSaving(true);
    const res = await onSave(draft);
    setSaving(false);
    if (res !== true) setError(res);
    else if (!draft.id) setDraft(emptyCSDraft);
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">{draft.id ? "Edit case study" : "Add case study"}</h2>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input
            className={cn(input, "mt-1.5")}
            value={draft.title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Slug (URL)</span>
          <input
            className={cn(input, "mt-1.5")}
            value={draft.slug}
            onChange={(e) =>
              setDraft((d) => ({ ...d, slug: slugify(e.target.value), slugLocked: true }))
            }
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            /work/{draft.slug || "…"}
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Client</span>
          <input
            className={cn(input, "mt-1.5")}
            placeholder="Client name or “Illustrative engagement”"
            value={draft.client}
            onChange={(e) => set("client", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Industry</span>
          <input
            className={cn(input, "mt-1.5")}
            list="cs-industry-options"
            value={draft.industry}
            onChange={(e) => set("industry", e.target.value)}
          />
          <datalist id="cs-industry-options">
            {CS_INDUSTRY_OPTIONS.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Status</span>
          <select
            className={cn(input, "mt-1.5")}
            value={draft.status}
            onChange={(e) => set("status", e.target.value as CSDraft["status"])}
          >
            <option value="sample">Illustrative (sample)</option>
            <option value="verified">Verified project</option>
          </select>
        </label>
      </div>

      <fieldset className="mt-4 rounded-xl border border-border bg-background p-4">
        <legend className="px-1 text-sm font-medium">Capabilities</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {CAPABILITY_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-xs",
                draft.capabilities.includes(o.value)
                  ? "border-brand bg-brand-soft text-[oklch(0.42_0.16_42)]"
                  : "border-border text-muted-foreground",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={draft.capabilities.includes(o.value)}
                onChange={() => toggleCapability(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block">
        <span className="text-sm font-medium">Summary</span>
        <textarea
          rows={2}
          className={cn(input, "mt-1.5 resize-y")}
          value={draft.summary}
          onChange={(e) => set("summary", e.target.value)}
        />
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium">The challenge</span>
        <textarea
          rows={3}
          className={cn(input, "mt-1.5 resize-y")}
          value={draft.challenge}
          onChange={(e) => set("challenge", e.target.value)}
        />
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">What we did</span>
          <span className="block text-xs text-muted-foreground">One step per line.</span>
          <textarea
            rows={4}
            className={cn(input, "mt-1.5 resize-y")}
            value={draft.approach}
            onChange={(e) => set("approach", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Deliverables</span>
          <span className="block text-xs text-muted-foreground">One item per line.</span>
          <textarea
            rows={4}
            className={cn(input, "mt-1.5 resize-y")}
            value={draft.deliverables}
            onChange={(e) => set("deliverables", e.target.value)}
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium">Outcome</span>
        <textarea
          rows={3}
          className={cn(input, "mt-1.5 resize-y")}
          value={draft.outcome}
          onChange={(e) => set("outcome", e.target.value)}
        />
      </label>

      <fieldset className="mt-4 rounded-xl border border-border bg-background p-4">
        <legend className="px-1 text-sm font-medium">Metrics</legend>
        <div className="space-y-2">
          {draft.metrics.map((m, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <input
                className={input}
                placeholder="Label"
                value={m.label}
                onChange={(e) => setMetric(i, { label: e.target.value })}
              />
              <input
                className={input}
                placeholder="Value"
                value={m.value}
                onChange={(e) => setMetric(i, { value: e.target.value })}
              />
              <input
                className={input}
                placeholder="Note (optional)"
                value={m.note}
                onChange={(e) => setMetric(i, { note: e.target.value })}
              />
              <button
                type="button"
                onClick={() =>
                  set(
                    "metrics",
                    draft.metrics.filter((_, idx) => idx !== i),
                  )
                }
                className="rounded-md border border-border px-2.5 py-1 text-xs text-destructive hover:border-destructive"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => set("metrics", [...draft.metrics, { label: "", value: "", note: "" }])}
          className="mt-2 rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-brand hover:text-brand"
        >
          + Add metric
        </button>
      </fieldset>

      <fieldset className="mt-4 rounded-xl border border-border bg-background p-4">
        <legend className="px-1 text-sm font-medium">Media</legend>
        <div className="space-y-3">
          {draft.media.map((m, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start gap-3">
                <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
                  {m.src ? (
                    m.type === "video" ? (
                      <video src={m.src} muted playsInline className="size-full object-cover" />
                    ) : (
                      <img
                        src={m.src}
                        alt={m.alt || draft.title || "Preview"}
                        className="size-full object-cover"
                      />
                    )
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
                    <input
                      className={input}
                      placeholder="Media URL"
                      value={m.src}
                      onChange={(e) => setMediaRow(i, { src: e.target.value })}
                    />
                    <select
                      className={input}
                      value={m.type}
                      onChange={(e) => setMediaRow(i, { type: e.target.value as MediaType })}
                    >
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                    </select>
                  </div>
                  <UploadField
                    bucket="work"
                    accept="image/*,video/*"
                    onUploaded={(url, mediaType) => setMediaRow(i, { src: url, type: mediaType })}
                  />
                  <input
                    className={input}
                    placeholder="Alt text"
                    value={m.alt}
                    onChange={(e) => setMediaRow(i, { alt: e.target.value })}
                  />
                  <input
                    className={input}
                    placeholder="Caption (optional)"
                    value={m.caption}
                    onChange={(e) => setMediaRow(i, { caption: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "media",
                      draft.media.filter((_, idx) => idx !== i),
                    )
                  }
                  className="rounded-md border border-border px-2.5 py-1 text-xs text-destructive hover:border-destructive"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            set("media", [...draft.media, { src: "", alt: "", caption: "", type: "image" }])
          }
          className="mt-2 rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-brand hover:text-brand"
        >
          + Add media
        </button>
      </fieldset>

      <fieldset className="mt-4 rounded-xl border border-border bg-background p-4">
        <legend className="px-1 text-sm font-medium">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.testimonialOn}
              onChange={(e) => set("testimonialOn", e.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />
            Testimonial
          </label>
        </legend>
        {draft.testimonialOn ? (
          <div className="space-y-2">
            <textarea
              rows={2}
              className={cn(input, "resize-y")}
              placeholder="Quote"
              value={draft.tQuote}
              onChange={(e) => set("tQuote", e.target.value)}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className={input}
                placeholder="Name"
                value={draft.tName}
                onChange={(e) => set("tName", e.target.value)}
              />
              <input
                className={input}
                placeholder="Role"
                value={draft.tRole}
                onChange={(e) => set("tRole", e.target.value)}
              />
            </div>
          </div>
        ) : null}
      </fieldset>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.published}
          onChange={(e) => set("published", e.target.checked)}
          className="size-4 accent-[var(--brand)]"
        />
        Published (visible on the public site)
      </label>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-70"
      >
        {saving ? "Saving…" : draft.id ? "Save changes" : "Add case study"}
      </button>
    </form>
  );
}

/* ------------------------------------------------ testimonials dashboard */

type Testimonial = {
  id: string;
  title: string;
  quote: string | null;
  media_type: MediaType;
  media_url: string;
  thumbnail_url: string | null;
  industry_slug: string | null;
  capability_slug: string | null;
  sort_order: number;
  published: boolean;
};

type TestimonialDraft = {
  id?: string;
  title: string;
  quote: string;
  mediaType: MediaType;
  mediaUrl: string;
  thumbnailUrl: string;
  industrySlug: string;
  capabilitySlug: string;
  published: boolean;
};

const emptyTestimonialDraft: TestimonialDraft = {
  title: "",
  quote: "",
  mediaType: "image",
  mediaUrl: "",
  thumbnailUrl: "",
  industrySlug: "",
  capabilitySlug: "",
  published: true,
};

function toTestimonialDraft(t: Testimonial): TestimonialDraft {
  return {
    id: t.id,
    title: t.title,
    quote: t.quote ?? "",
    mediaType: t.media_type,
    mediaUrl: t.media_url,
    thumbnailUrl: t.thumbnail_url ?? "",
    industrySlug: t.industry_slug ?? "",
    capabilitySlug: t.capability_slug ?? "",
    published: t.published,
  };
}

function TestimonialDashboard() {
  const [items, setItems] = useState<Testimonial[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<TestimonialDraft | null>(null);
  const dragId = useRef<string | null>(null);

  const load = useCallback(async () => {
    const { status, body } = await api<{ ok: boolean; items: Testimonial[] }>(
      "/api/admin/testimonials",
    );
    if (status === 200 && body.ok) {
      setItems(body.items);
      setLoadError("");
    } else {
      setLoadError(
        status === 503
          ? "Storage is not connected yet (missing Supabase service role key)."
          : "Could not load testimonials.",
      );
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persistOrder = useCallback(async (ordered: Testimonial[]) => {
    setItems(ordered);
    await api("/api/admin/testimonials/reorder", {
      method: "POST",
      body: JSON.stringify({ ids: ordered.map((i) => i.id) }),
    });
  }, []);

  const reorder = useCallback(
    (fromId: string, toId: string) => {
      if (!items || fromId === toId) return;
      const from = items.findIndex((i) => i.id === fromId);
      const to = items.findIndex((i) => i.id === toId);
      if (from < 0 || to < 0) return;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      void persistOrder(next);
    },
    [items, persistOrder],
  );

  const move = useCallback(
    (id: string, dir: -1 | 1) => {
      if (!items) return;
      const idx = items.findIndex((i) => i.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= items.length) return;
      reorder(id, items[target]!.id);
    },
    [items, reorder],
  );

  async function saveDraft(draft: TestimonialDraft) {
    const payload = {
      title: draft.title,
      quote: draft.quote,
      mediaType: draft.mediaType,
      mediaUrl: draft.mediaUrl,
      thumbnailUrl: draft.thumbnailUrl,
      industrySlug: draft.industrySlug,
      capabilitySlug: draft.capabilitySlug,
      published: draft.published,
    };
    const { status, body } = draft.id
      ? await api<{ ok: boolean }>(`/api/admin/testimonials/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      : await api<{ ok: boolean }>("/api/admin/testimonials", {
          method: "POST",
          body: JSON.stringify(payload),
        });
    if (status === 200 && body.ok) {
      setEditing(null);
      await load();
      return true;
    }
    return false;
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this testimonial?")) return;
    await api(`/api/admin/testimonials/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Review screenshots and client testimonial videos — kept separate from the service portfolio,
        which is delivered work. Tag one to an industry, and optionally a specific service, to show
        it there.
      </p>

      <TestimonialForm
        key={editing?.id ?? "new"}
        initial={editing ?? emptyTestimonialDraft}
        onCancel={editing ? () => setEditing(null) : undefined}
        onSave={saveDraft}
      />

      {loadError ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {loadError}
        </p>
      ) : null}

      {items === null ? (
        <p className="text-sm text-muted-foreground">Loading testimonials…</p>
      ) : items.length === 0 && !loadError ? (
        <p className="text-sm text-muted-foreground">No testimonials yet. Add one above.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((t, i) => (
            <li
              key={t.id}
              draggable
              onDragStart={() => (dragId.current = t.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId.current) reorder(dragId.current, t.id);
                dragId.current = null;
              }}
            >
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <span
                  className="cursor-grab select-none px-1 text-muted-foreground"
                  title="Drag to reorder"
                  aria-hidden="true"
                >
                  ⠿
                </span>
                <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
                  {t.media_type === "video" ? (
                    <video
                      src={t.media_url}
                      poster={t.thumbnail_url ?? undefined}
                      muted
                      playsInline
                      className="size-full object-cover"
                    />
                  ) : (
                    <img src={t.media_url} alt={t.title} className="size-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="rounded-full bg-secondary px-2 py-0.5">{t.media_type}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5">
                      {industryName(t.industry_slug)}
                    </span>
                    {t.capability_slug ? (
                      <span className="rounded-full bg-secondary px-2 py-0.5">
                        {CAPABILITY_OPTIONS.find((c) => c.value === t.capability_slug)?.label ??
                          t.capability_slug}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={async () => {
                        await api(`/api/admin/testimonials/${t.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ published: !t.published }),
                        });
                        await load();
                      }}
                      className={cn(
                        "rounded-full px-2 py-0.5",
                        t.published
                          ? "bg-brand-soft text-[oklch(0.42_0.16_42)]"
                          : "bg-secondary text-muted-foreground line-through",
                      )}
                    >
                      {t.published ? "Published" : "Hidden"}
                    </button>
                  </p>
                </div>
                <RowControls
                  first={i === 0}
                  last={i === items.length - 1}
                  onUp={() => move(t.id, -1)}
                  onDown={() => move(t.id, 1)}
                  onEdit={() => setEditing(toTestimonialDraft(t))}
                  onDelete={() => void remove(t.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TestimonialForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: TestimonialDraft;
  onSave: (d: TestimonialDraft) => Promise<boolean>;
  onCancel?: (() => void) | undefined;
}) {
  const [draft, setDraft] = useState<TestimonialDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof TestimonialDraft>(k: K, v: TestimonialDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!draft.title.trim()) return setError("Title is required.");
    if (!draft.mediaUrl.trim())
      return setError(draft.mediaType === "video" ? "Upload a video." : "Upload a screenshot.");
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (!ok) setError("Could not save. Try again.");
    else if (!draft.id) setDraft(emptyTestimonialDraft);
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">
          {draft.id ? "Edit testimonial" : "Add testimonial"}
        </h2>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium">Title</span>
        <input
          className={cn(input, "mt-1.5")}
          placeholder="e.g. sanman_thapa, five star review"
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium">Quote / context (optional)</span>
        <textarea
          rows={2}
          className={cn(input, "mt-1.5 resize-y")}
          placeholder="Short excerpt or context shown under the screenshot."
          value={draft.quote}
          onChange={(e) => set("quote", e.target.value)}
        />
      </label>

      <div className="mt-4 rounded-xl border border-border bg-background p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {draft.mediaType === "video" ? "Video" : "Screenshot"}
          </span>
          <div className="ml-auto flex rounded-full border border-border p-0.5 text-xs">
            {(["image", "video"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set("mediaType", t)}
                className={cn(
                  "rounded-full px-3 py-1 font-medium capitalize",
                  draft.mediaType === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <div className="size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
            {draft.mediaUrl ? (
              draft.mediaType === "video" ? (
                <video
                  src={draft.mediaUrl}
                  poster={draft.thumbnailUrl || undefined}
                  muted
                  playsInline
                  className="size-full object-cover"
                />
              ) : (
                <img
                  src={draft.mediaUrl}
                  alt={draft.title || "Preview"}
                  className="size-full object-cover"
                />
              )
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <UploadField
              bucket="testimonials"
              accept={draft.mediaType === "video" ? "video/*" : "image/*"}
              onUploaded={(url) => set("mediaUrl", url)}
              hint={
                draft.mediaType === "video"
                  ? "Video up to 50 MB. Larger: host elsewhere and paste the URL."
                  : "Images up to 50 MB."
              }
            />
            <input
              className={cn(input, "mt-2")}
              placeholder={
                draft.mediaType === "video" ? "…or paste a video URL" : "…or paste an image URL"
              }
              value={draft.mediaUrl}
              onChange={(e) => set("mediaUrl", e.target.value)}
            />
          </div>
        </div>

        {draft.mediaType === "video" ? (
          <div className="mt-3">
            <span className="text-xs font-medium text-muted-foreground">
              Poster / thumbnail (optional)
            </span>
            <div className="mt-1.5">
              <UploadField
                bucket="testimonials"
                accept="image/*"
                onUploaded={(url) => set("thumbnailUrl", url)}
                hint="Shown before the video plays."
              />
              <input
                className={cn(input, "mt-2")}
                placeholder="…or paste a poster image URL"
                value={draft.thumbnailUrl}
                onChange={(e) => set("thumbnailUrl", e.target.value)}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Industry (optional)</span>
          <select
            className={cn(input, "mt-1.5")}
            value={draft.industrySlug}
            onChange={(e) => set("industrySlug", e.target.value)}
          >
            <option value="">— Shown everywhere —</option>
            {INDUSTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Service (optional)</span>
          <select
            className={cn(input, "mt-1.5")}
            value={draft.capabilitySlug}
            onChange={(e) => set("capabilitySlug", e.target.value)}
          >
            <option value="">— General —</option>
            {CAPABILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.published}
          onChange={(e) => set("published", e.target.checked)}
          className="size-4 accent-[var(--brand)]"
        />
        Published (visible on the public site)
      </label>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-70"
      >
        {saving ? "Saving…" : draft.id ? "Save changes" : "Add testimonial"}
      </button>
    </form>
  );
}
