import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { CAPABILITIES } from "@/data/capabilities";
import { INDUSTRIES } from "@/data/industries";
import { TrainerTools } from "@/components/academy/TrainerTools";

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

/* ------------------------------------------------------------------- root */

export function AdminApp() {
  const [state, setState] = useState<"loading" | "gate" | "unconfigured" | "ready">("loading");
  const [section, setSection] = useState<"portfolio" | "academy">("portfolio");

  const refreshSession = useCallback(async () => {
    try {
      const { body } = await api<{ authed: boolean; configured: boolean }>("/api/admin/session");
      if (!body.configured) setState("unconfigured");
      else setState(body.authed ? "ready" : "gate");
    } catch {
      setState("gate");
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  return (
    <div className="min-h-[70vh] bg-secondary/40">
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
              HQ360 admin
            </p>
            <h1 className="mt-1 font-display text-2xl">
              {section === "academy" ? "Author Scout Academy" : "Service portfolio"}
            </h1>
          </div>
          {state === "ready" ? (
            <button
              type="button"
              onClick={async () => {
                await api("/api/admin/session", { method: "DELETE" });
                setState("gate");
              }}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:border-brand hover:text-brand"
            >
              Sign out
            </button>
          ) : null}
        </div>

        <div className="mt-8">
          {state === "loading" ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
          {state === "unconfigured" ? <Unconfigured /> : null}
          {state === "gate" ? <Gate onAuthed={() => setState("ready")} /> : null}
          {state === "ready" ? (
            <>
              <div className="mb-6 flex w-fit rounded-full border border-border bg-card p-1 text-sm">
                {(
                  [
                    ["portfolio", "Portfolio"],
                    ["academy", "Author Scout Academy"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSection(key)}
                    className={cn(
                      "rounded-full px-4 py-1.5 font-medium",
                      section === key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {section === "portfolio" ? <Dashboard /> : <AcademyAdmin />}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Unconfigured() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-sm leading-relaxed text-muted-foreground">
      <p className="font-medium text-foreground">This page is not enabled yet.</p>
      <p className="mt-2">
        Set an <code className="rounded bg-secondary px-1.5 py-0.5">ADMIN_PASSWORD</code>{" "}
        environment variable (at least 6 characters) and reload. See <code>.env.example</code>.
      </p>
    </div>
  );
}

function Gate({ onAuthed }: { onAuthed: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError("");
    const { status } = await api("/api/admin/session", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (status === 200) onAuthed();
    else if (status === 401) setError("Wrong password.");
    else setError("Could not sign in. Try again.");
  }

  return (
    <form onSubmit={submit} className="max-w-sm rounded-2xl border border-border bg-card p-6">
      <label htmlFor="admin-pw" className="text-sm font-medium">
        Admin password
      </label>
      <input
        id="admin-pw"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-70"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

/* ---------------------------------------------------------------- academy */

// Uses the admin passphrase cookie, so no Supabase login is needed here.
async function cookieFetch<T>(url: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as T };
}

function AcademyAdmin() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Trainee training and AI practice room</p>
          <p className="mt-1">
            Trainees sign in at <code>/academy</code>. Manage trainees, the Response Bank, hints,
            feedback and model lines here. To publish demos, sign in to the academy as a trainer.
          </p>
        </div>
        <a
          href="/academy"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Open the academy
        </a>
      </div>
      <div className="asa asa-embed">
        <TrainerTools fetcher={cookieFetch} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- dashboard */

function Dashboard() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const dragId = useRef<string | null>(null);

  const load = useCallback(async () => {
    const { status, body } = await api<{ ok: boolean; items: Item[] }>("/api/admin/portfolio");
    if (status === 200 && body.ok) {
      setItems(body.items);
      setLoadError("");
    } else if (status === 401) {
      window.location.reload();
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
      // Rebuild the full ordered list: same group sequence, this group replaced.
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

      {items === null ? (
        <p className="text-sm text-muted-foreground">Loading items…</p>
      ) : items.length === 0 && !loadError ? (
        <p className="text-sm text-muted-foreground">No portfolio items yet. Add one above.</p>
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
                      onTogglePublish={async () => {
                        await api(`/api/admin/portfolio/${it.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ published: !it.published }),
                        });
                        await load();
                      }}
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
  onUp,
  onDown,
  onEdit,
  onDelete,
  onTogglePublish,
}: {
  item: Item;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
}) {
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
          <img src={item.media_url} alt="" className="size-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
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
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        mediaType?: MediaType;
        error?: string;
      };
      if (res.ok && body.ok && body.url) {
        setDraft((d) => ({
          ...d,
          mediaUrl: body.url!,
          mediaType: body.mediaType ?? d.mediaType,
        }));
      } else {
        setError(
          body.error === "too_large"
            ? "File is over 50 MB. Host it elsewhere and paste the URL."
            : body.error === "unsupported_type"
              ? "Unsupported file type."
              : body.error === "unavailable"
                ? "Uploads need the Supabase service role key configured."
                : "Upload failed.",
        );
      }
    } catch {
      setError("Upload failed.");
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

  const input =
    "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
                <img src={draft.mediaUrl} alt="" className="size-full object-cover" />
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
