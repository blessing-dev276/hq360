import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./shared";
import {
  CONTENT_KINDS,
  inlineSegments,
  isNew,
  NICHE_FIELDS,
  parseBody,
  svgDataUri,
  todaysLesson,
  type Block,
  type ContentRecord,
} from "@/lib/academy/content";
import type { Fetcher } from "./Library";

function useContent() {
  const [records, setRecords] = useState<ContentRecord[] | null>(null);
  useEffect(() => {
    void api<{ records: ContentRecord[] }>("/api/academy/content").then(({ status, body }) =>
      setRecords(status === 200 ? body.records : []),
    );
  }, []);
  return records;
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineSegments(text).map((s, i) =>
        s.bold ? <b key={i}>{s.text}</b> : s.italic ? <i key={i}>{s.text}</i> : <span key={i}>{s.text}</span>,
      )}
    </>
  );
}

function CopyLine({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="asa-quote good" style={{ display: "grid", gap: 8, margin: "12px 0" }}>
      <span>{text}</span>
      <button
        type="button"
        className="asa-btn asa-btn-ghost asa-btn-sm"
        style={{ justifySelf: "start" }}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          } catch {
            /* clipboard blocked */
          }
        }}
      >
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Diagram({ record }: { record: ContentRecord }) {
  if (!record.svg) return null;
  return (
    <figure className="asa-card" style={{ margin: "18px 0" }}>
      {/* An <img> never runs script inside the SVG; the SVG's own
          prefers-color-scheme styles still switch for dark mode. */}
      <img src={svgDataUri(record.svg)} alt={record.summary || record.title} style={{ width: "100%", height: "auto" }} />
      <figcaption className="asa-muted" style={{ fontSize: 13, marginTop: 8 }}>
        {record.title}
      </figcaption>
    </figure>
  );
}

export function RecordBody({ body, diagrams }: { body: string; diagrams: ContentRecord[] }) {
  const render = (block: Block, i: number): ReactNode => {
    switch (block.type) {
      case "heading":
        return <h3 key={i}>{block.text}</h3>;
      case "paragraph":
        return (
          <p key={i}>
            <Inline text={block.text} />
          </p>
        );
      case "list": {
        const List = block.ordered ? "ol" : "ul";
        return (
          <List key={i}>
            {block.items.map((item, j) => (
              <li key={j}>
                <Inline text={item} />
              </li>
            ))}
          </List>
        );
      }
      case "copy":
        return <CopyLine key={i} text={block.text} />;
      case "quote":
        return (
          <blockquote key={i} className="asa-quote">
            <Inline text={block.text} />
          </blockquote>
        );
      case "note":
        return (
          <div key={i} className="asa-callout">
            <Inline text={block.text} />
          </div>
        );
      case "table":
        return (
          <div key={i} className="asa-scroll-x">
            <table className="asa-table">
              <thead>
                <tr>
                  {block.header.map((h, j) => (
                    <th key={j}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, j) => (
                  <tr key={j}>
                    {row.map((cell, k) => (
                      <td key={k}>
                        <Inline text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "diagram": {
        const diagram = diagrams.find((d) => d.slug === block.slug);
        return diagram ? <Diagram key={i} record={diagram} /> : null;
      }
    }
  };
  return <>{parseBody(body).map(render)}</>;
}

const NewBadge = ({ at }: { at: string | null }) =>
  isNew(at) ? (
    <span className="asa-label" style={{ color: "var(--asa-good)", marginRight: 8 }}>
      New
    </span>
  ) : null;

/** The "Today's lesson" strip at the top of the playbook. */
export function TodaysLessonStrip({ onOpen }: { onOpen: (record: ContentRecord) => void }) {
  const records = useContent();
  const lesson = records ? todaysLesson(records) : null;
  if (!lesson) return null;
  return (
    <div className="asa-card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "18px 0" }}>
      <NewBadge at={lesson.published_at} />
      <span className="asa-muted">Today's lesson:</span>
      <b style={{ flex: "1 1 240px" }}>{lesson.title}</b>
      <button type="button" className="asa-link asa-orange" onClick={() => onOpen(lesson)}>
        Read it
      </button>
    </div>
  );
}

/** Business Playbook chapters, niche guides, daily lessons and diagrams from content records. */
export function ContentLibrary({ focus }: { focus?: string | null }) {
  const records = useContent();
  const [group, setGroup] = useState("All");
  useEffect(() => {
    if (focus && records) document.getElementById(`rec-${focus}`)?.scrollIntoView({ behavior: "smooth" });
  }, [focus, records]);
  const diagrams = useMemo(() => (records ?? []).filter((r) => r.kind === "diagram"), [records]);
  if (!records) return <p className="asa-wrap asa-muted">Loading…</p>;
  const chapters = records.filter((r) => r.kind === "chapter" && r.playbook === "business");
  const guides = records.filter((r) => r.kind === "niche_guide");
  const lessons = records
    .filter((r) => r.kind === "daily_lesson")
    .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  const groups = ["All", ...new Set(guides.map((g) => g.group_name).filter(Boolean))];
  const shownGuides = group === "All" ? guides : guides.filter((g) => g.group_name === group);

  return (
    <div className="asa-wrap" style={{ padding: "32px 16px 64px" }}>
      <div className="asa-label">HQ360 training · Business outreach</div>
      <h1 style={{ fontSize: 40, margin: "6px 0 10px" }}>
        The Business <span className="asa-orange">Playbook</span>
      </h1>
      <div className="asa-counters">
        {[
          [chapters.length, "chapters"],
          [guides.length, "niche guides"],
          [lessons.length, "daily lessons"],
        ].map(([n, t]) => (
          <div key={t}>
            <b>{n}</b>
            <span className="asa-muted">{t}</span>
          </div>
        ))}
      </div>

      {chapters.length === 0 && guides.length === 0 && (
        <p className="asa-muted">Your trainer has not published Business Playbook chapters yet.</p>
      )}

      {chapters.map((chapter) => (
        <section key={chapter.id} id={`rec-${chapter.id}`} className="asa-chapter">
          <div className="asa-label">
            <NewBadge at={chapter.published_at} />
            Chapter {chapter.number != null ? String(chapter.number).padStart(2, "0") : ""} {chapter.part && `· ${chapter.part}`}
          </div>
          <h2>{chapter.title}</h2>
          {chapter.summary && <p className="asa-muted" style={{ fontSize: 18 }}>{chapter.summary}</p>}
          <RecordBody body={chapter.body} diagrams={diagrams} />
        </section>
      ))}

      {guides.length > 0 && (
        <section className="asa-chapter" aria-labelledby="niche-guides">
          <h2 id="niche-guides">Niche guides</h2>
          <div className="asa-tabs" role="group" aria-label="Filter niche guides" style={{ flexWrap: "wrap", marginBottom: 16 }}>
            {groups.map((g) => (
              <button key={g} type="button" className="asa-tab" aria-pressed={group === g} aria-current={group === g ? "true" : undefined} onClick={() => setGroup(g)}>
                {g}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {shownGuides.map((guide) => (
              <details key={guide.id} id={`rec-${guide.id}`} className="asa-card">
                <summary style={{ cursor: "pointer" }}>
                  <NewBadge at={guide.published_at} />
                  <b>{guide.title}</b> <span className="asa-muted">· {guide.group_name}</span>
                </summary>
                {guide.summary && <p>{guide.summary}</p>}
                <dl>
                  {NICHE_FIELDS.filter(([key]) => key !== "first_message" && guide.fields?.[key]).map(([key, label]) => (
                    <div key={key} style={{ marginBottom: 10 }}>
                      <dt style={{ fontWeight: 700 }}>{label}</dt>
                      <dd style={{ margin: 0 }}>
                        <Inline text={guide.fields[key]!} />
                      </dd>
                    </div>
                  ))}
                </dl>
                {guide.fields?.first_message && (
                  <>
                    <div className="asa-label">First message</div>
                    <CopyLine text={guide.fields.first_message} />
                  </>
                )}
                <RecordBody body={guide.body} diagrams={diagrams} />
              </details>
            ))}
          </div>
        </section>
      )}

      {lessons.length > 0 && (
        <section className="asa-chapter" aria-labelledby="daily-lessons">
          <h2 id="daily-lessons">Daily lessons</h2>
          {lessons.map((lesson) => (
            <article key={lesson.id} id={`rec-${lesson.id}`} className="asa-card" style={{ marginBottom: 14 }}>
              <div className="asa-label">
                <NewBadge at={lesson.published_at} />
                {lesson.group_name} {lesson.lesson_date && `· ${new Date(`${lesson.lesson_date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
              </div>
              <h3>{lesson.title}</h3>
              <RecordBody body={lesson.body} diagrams={diagrams} />
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

type Version = { version: number; editor: string; edited_at: string; snapshot: Partial<ContentRecord> };
const EMPTY: Omit<ContentRecord, "id" | "updated_at" | "updated_by" | "published_at"> = {
  kind: "chapter",
  playbook: "business",
  slug: "",
  number: null,
  part: "",
  group_name: "",
  title: "",
  summary: "",
  body: "",
  fields: {},
  svg: null,
  sort_order: 0,
  published: false,
  lesson_date: null,
};

/** Trainer tools: add and edit chapters, niche guides, daily lessons and SVG diagrams. */
export function ContentEditor({ fetcher }: { fetcher: Fetcher }) {
  const [records, setRecords] = useState<ContentRecord[] | null>(null);
  const [editing, setEditing] = useState<(typeof EMPTY & { id?: string }) | null>(null);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [kind, setKind] = useState<string>("all");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const load = useCallback(async () => {
    const { status, body } = await fetcher<{ records: ContentRecord[] }>("/api/academy/admin/playbook");
    if (status === 200) setRecords(body.records);
    else setError("Could not load the content.");
  }, [fetcher]);
  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!editing) return;
    setError("");
    setSaved("");
    // Send only editable fields; ids, timestamps and editor are set by the server.
    const record = Object.fromEntries(
      [...Object.keys(EMPTY), "id"].filter((k) => k in editing).map((k) => [k, editing[k as keyof typeof editing]]),
    );
    const { status, body } = await fetcher<{ record: ContentRecord; error?: string }>("/api/academy/admin/playbook", {
      method: "POST",
      body: { record },
    });
    if (status !== 200) return setError(body.error === "storage" ? "Could not save." : String(body.error ?? "Could not save."));
    setSaved(`Saved "${body.record.title}". A new version was recorded.`);
    setEditing({ ...editing, id: body.record.id });
    await load();
  }

  async function showVersions(id: string) {
    const { status, body } = await fetcher<{ versions: Version[] }>(`/api/academy/admin/playbook?versions=${id}`);
    setVersions(status === 200 ? body.versions : []);
  }

  if (editing) {
    const set = (patch: Partial<typeof editing>) => setEditing({ ...editing, ...patch });
    const text = (key: "title" | "slug" | "part" | "group_name" | "summary", label: string) => (
      <label style={{ display: "grid", gap: 4 }}>
        <b style={{ fontSize: 14 }}>{label}</b>
        <input className="asa-input" value={editing[key]} onChange={(e) => set({ [key]: e.target.value })} />
      </label>
    );
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <button type="button" className="asa-link" onClick={() => { setEditing(null); setVersions(null); }}>
          ← All content
        </button>
        {error && <p role="alert" style={{ color: "var(--asa-bad)" }}>{error}</p>}
        {saved && <p role="status">{saved}</p>}
        <div className="asa-grid-2">
          <label style={{ display: "grid", gap: 4 }}>
            <b style={{ fontSize: 14 }}>Type</b>
            <select className="asa-input" value={editing.kind} onChange={(e) => set({ kind: e.target.value as ContentRecord["kind"] })}>
              {CONTENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <b style={{ fontSize: 14 }}>Playbook</b>
            <select className="asa-input" value={editing.playbook} onChange={(e) => set({ playbook: e.target.value as "author" | "business" })}>
              <option value="business">Business Playbook</option>
              <option value="author">Author Playbook</option>
            </select>
          </label>
          {text("title", "Title")}
          {text("slug", "Slug (lowercase-with-hyphens, used in [[diagram:slug]])")}
          <label style={{ display: "grid", gap: 4 }}>
            <b style={{ fontSize: 14 }}>Chapter number</b>
            <input className="asa-input" type="number" value={editing.number ?? ""} onChange={(e) => set({ number: e.target.value === "" ? null : Number(e.target.value) })} />
          </label>
          {text("part", "Part (e.g. Part three)")}
          {text("group_name", editing.kind === "niche_guide" ? "Filter group" : "Category label")}
          <label style={{ display: "grid", gap: 4 }}>
            <b style={{ fontSize: 14 }}>Sort order</b>
            <input className="asa-input" type="number" value={editing.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) || 0 })} />
          </label>
          {editing.kind === "daily_lesson" && (
            <label style={{ display: "grid", gap: 4 }}>
              <b style={{ fontSize: 14 }}>Lesson date</b>
              <input className="asa-input" type="date" value={editing.lesson_date ?? ""} onChange={(e) => set({ lesson_date: e.target.value || null })} />
            </label>
          )}
        </div>
        {text("summary", "Summary (also the diagram's alt text)")}
        {editing.kind === "niche_guide" &&
          NICHE_FIELDS.map(([key, label]) => (
            <label key={key} style={{ display: "grid", gap: 4 }}>
              <b style={{ fontSize: 14 }}>{label}</b>
              <textarea className="asa-input" rows={2} value={editing.fields[key] ?? ""} onChange={(e) => set({ fields: { ...editing.fields, [key]: e.target.value } })} />
            </label>
          ))}
        {editing.kind === "diagram" ? (
          <label style={{ display: "grid", gap: 4 }}>
            <b style={{ fontSize: 14 }}>SVG (use a prefers-color-scheme style inside for dark mode; no scripts or external links)</b>
            <textarea className="asa-input" rows={10} style={{ fontFamily: "monospace", fontSize: 12 }} value={editing.svg ?? ""} onChange={(e) => set({ svg: e.target.value })} />
          </label>
        ) : (
          <label style={{ display: "grid", gap: 4 }}>
            <b style={{ fontSize: 14 }}>Body</b>
            <span className="asa-muted" style={{ fontSize: 13 }}>
              ### heading · - list · 1. numbered · | table | rows | · "&gt; copy: text" adds a Copy button · "&gt; note: text" callout · [[diagram:slug]] · **bold** · _italic_
            </span>
            <textarea className="asa-input" rows={16} value={editing.body} onChange={(e) => set({ body: e.target.value })} />
          </label>
        )}
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={editing.published} onChange={(e) => set({ published: e.target.checked })} />
          Published (new items show a New badge for 7 days and appear in Today's lesson)
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="asa-btn" onClick={() => void save()}>
            Save
          </button>
          {editing.id && (
            <button type="button" className="asa-btn asa-btn-ghost" onClick={() => void showVersions(editing.id!)}>
              Version history
            </button>
          )}
        </div>
        {editing.kind !== "diagram" && editing.body && (
          <div className="asa-card">
            <div className="asa-label">Preview</div>
            <RecordBody body={editing.body} diagrams={(records ?? []).filter((r) => r.kind === "diagram")} />
          </div>
        )}
        {editing.kind === "diagram" && editing.svg && (
          <img src={svgDataUri(editing.svg)} alt="Diagram preview" style={{ maxWidth: "100%" }} />
        )}
        {versions && (
          <div className="asa-card">
            <div className="asa-label">Version history</div>
            <ol>
              {versions.map((v) => (
                <li key={v.version}>
                  Version {v.version} by {v.editor}, {new Date(v.edited_at).toLocaleString("en-GB")}{" "}
                  <button type="button" className="asa-link" onClick={() => setEditing({ ...editing, ...(v.snapshot as Partial<typeof editing>), id: editing.id })}>
                    Load into editor
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    );
  }

  const shown = (records ?? []).filter((r) => kind === "all" || r.kind === kind);
  return (
    <div>
      <p className="asa-muted">Chapters, niche guides, daily lessons and diagrams. No developer needed; every save keeps a version.</p>
      {error && <p role="alert" style={{ color: "var(--asa-bad)" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <select className="asa-input" style={{ maxWidth: 220 }} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter by type">
          <option value="all">All types</option>
          {CONTENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {k.replace("_", " ")}
            </option>
          ))}
        </select>
        <button type="button" className="asa-btn" onClick={() => setEditing({ ...EMPTY })}>
          Add content
        </button>
      </div>
      {records === null ? (
        <p className="asa-muted">Loading…</p>
      ) : (
        <table className="asa-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Last edit</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>
                  <button type="button" className="asa-link" onClick={() => setEditing(r)}>
                    {r.number != null ? `${r.number}. ` : ""}
                    {r.title}
                  </button>
                </td>
                <td>{r.kind.replace("_", " ")}</td>
                <td>{r.published ? "Published" : "Draft"}</td>
                <td>
                  {r.updated_by}, {new Date(r.updated_at).toLocaleDateString("en-GB")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
