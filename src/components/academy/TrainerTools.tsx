import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./shared";
import { TraineesAdmin, type Fetcher } from "./Library";

const AUTHORS = [
  "Margaret Doyle",
  "Darnell Price",
  "Priya Raman",
  "Tom Okafor",
  "Linda Marsh",
  "Kevin Hale",
  "Rosa Delgado",
  "Harold Jensen",
];
const REACTIONS = [
  "no_reply",
  "who_are_you",
  "rude",
  "end_firm_no",
  "guarantee_trap",
  "wrong_fact",
  "price_too_early",
  "pressure_pushback",
  "template_callout",
  "stop_emailing",
  "objection_reveal",
  "question_barrage",
  "polite_decline",
  "soft_decline",
  "scam_suspicion",
  "cold_short",
  "proof_request",
  "objection_hint",
  "curious_question",
  "warming",
  "agree_small_step",
  "won_followup",
];
const SHOW_MAX = 200;

type Row = Record<string, string | boolean | number | null> & { id: string };
type Section = "trainees" | "bank" | "hints" | "feedback" | "model" | "weak";

/** Trainer area: trainees plus every editable part of the Author Engine. */
export function TrainerTools({ fetcher = api as Fetcher }: { fetcher?: Fetcher }) {
  const [section, setSection] = useState<Section>("trainees");
  const tabs: [Section, string][] = [
    ["trainees", "Trainees"],
    ["bank", "Response bank"],
    ["hints", "Hints"],
    ["feedback", "Feedback lines"],
    ["model", "Model lines"],
    ["weak", "Weak spots"],
  ];
  return (
    <div>
      <div className="asa-tabs" style={{ marginBottom: 20, flexWrap: "wrap" }}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="asa-tab"
            aria-current={section === key ? "page" : undefined}
            onClick={() => setSection(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {section === "trainees" ? <TraineesAdmin fetcher={fetcher} /> : null}
      {section === "bank" ? <BankEditor fetcher={fetcher} /> : null}
      {section === "hints" ? (
        <TableEditor
          fetcher={fetcher}
          table="hints"
          fields={[{ key: "rule", label: "Rule" }]}
          intro="Hints are checked in a fixed order (section G). Edit the text; keep the rule names as they are."
        />
      ) : null}
      {section === "feedback" ? (
        <TableEditor
          fetcher={fetcher}
          table="feedback"
          fields={[
            { key: "signal", label: "Signal" },
            { key: "kind", label: "Kind", options: ["worked", "change", "summary"] },
          ]}
          intro="Lines shown in What worked and What to change, keyed by signal. Summary lines are keyed summary_won, summary_warming, summary_neutral, summary_cooling and summary_lost."
        />
      ) : null}
      {section === "model" ? (
        <TableEditor
          fetcher={fetcher}
          table="model_lines"
          fields={[
            { key: "author", label: "Author", options: AUTHORS },
            { key: "reaction", label: "Reaction", options: REACTIONS },
          ]}
          intro="The stronger line shown in coaching, chosen for the reaction caused by the trainee's weakest message."
        />
      ) : null}
      {section === "weak" ? <WeakSpots fetcher={fetcher} /> : null}
    </div>
  );
}

/* ---------------------------------------------------------- response bank */

function BankEditor({ fetcher }: { fetcher: Fetcher }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [author, setAuthor] = useState(AUTHORS[0]!);
  const [reaction, setReaction] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { status, body } = await fetcher<{ rows: Row[]; usage: Record<string, number> }>(
      "/api/academy/admin/content?table=response_bank",
    );
    if (status === 200) {
      setRows(body.rows);
      setUsage(body.usage ?? {});
    } else setError("Could not load the response bank.");
  }, [fetcher]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      (rows ?? []).filter(
        (r) => (!author || r.author === author) && (!reaction || r.reaction === reaction),
      ),
    [rows, author, reaction],
  );

  async function save(row: Partial<Row>) {
    const { status } = await fetcher("/api/academy/admin/content", {
      method: "POST",
      body: { table: "response_bank", row },
    });
    if (status !== 200) setError("Could not save that line.");
    await load();
  }

  async function add() {
    if (!draft.trim() || !author || !reaction) {
      setError("Choose an author (or ANY) and a reaction, then write the line.");
      return;
    }
    setError("");
    await save({ author, reaction, text: draft.trim(), active: true });
    setDraft("");
  }

  return (
    <div>
      <p className="asa-muted" style={{ marginTop: 0, fontSize: 14 }}>
        Placeholders: {"{first}"}, {"{book}"}, {"{wrong}"}, {"{signoff}"}. ANY lines are backups,
        used in the author's voice when their own lines run out.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <select className="asa-input" style={{ width: "auto" }} value={author} onChange={(e) => setAuthor(e.target.value)}>
          <option value="">All authors</option>
          {[...AUTHORS, "ANY"].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select className="asa-input" style={{ width: "auto" }} value={reaction} onChange={(e) => setReaction(e.target.value)}>
          <option value="">All reactions</option>
          {REACTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <span className="asa-muted" style={{ alignSelf: "center", fontSize: 13 }}>
          {filtered.length} lines
        </span>
      </div>
      <div className="asa-card" style={{ marginBottom: 16 }}>
        <label htmlFor="asa-new-line" style={{ fontWeight: 600, fontSize: 14 }}>
          Add a line for {author || "the chosen author"} · {reaction || "choose a reaction"}
        </label>
        <textarea
          id="asa-new-line"
          className="asa-input"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{ marginTop: 6 }}
        />
        <button type="button" className="asa-btn asa-btn-sm" style={{ marginTop: 10 }} onClick={() => void add()}>
          Add line
        </button>
        {error ? <p style={{ color: "var(--asa-bad)", fontSize: 14 }}>{error}</p> : null}
      </div>
      {rows === null ? (
        <p className="asa-muted">Loading...</p>
      ) : (
        <div className="asa-card asa-scroll-x" style={{ padding: 8 }}>
          <table className="asa-table">
            <thead>
              <tr>
                <th>Author</th>
                <th>Reaction</th>
                <th style={{ minWidth: 280 }}>Line</th>
                <th>Used</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, SHOW_MAX).map((r) => (
                <EditableRow
                  key={r.id}
                  row={r}
                  cells={[String(r.author), String(r.reaction)]}
                  extra={
                    <>
                      <td>{usage[r.id] ?? 0}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(r.active)}
                          onChange={(e) => void save({ ...r, active: e.target.checked })}
                          aria-label="Active"
                        />
                      </td>
                    </>
                  }
                  onSave={(text) => save({ ...r, text })}
                />
              ))}
            </tbody>
          </table>
          {filtered.length > SHOW_MAX ? (
            <p className="asa-muted" style={{ fontSize: 13, padding: 8 }}>
              Showing the first {SHOW_MAX}. Filter by author or reaction to see the rest.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function EditableRow({
  row,
  cells,
  extra,
  onSave,
  onDelete,
}: {
  row: Row;
  cells: string[];
  extra?: React.ReactNode;
  onSave: (text: string) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [text, setText] = useState(String(row.text ?? ""));
  const [busy, setBusy] = useState(false);
  const dirty = text !== row.text;
  return (
    <tr>
      {cells.map((c, i) => (
        <td key={i} style={{ whiteSpace: "nowrap" }}>
          {c}
        </td>
      ))}
      <td>
        <textarea
          className="asa-input"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ fontSize: 13, padding: 8 }}
        />
      </td>
      {extra}
      <td style={{ whiteSpace: "nowrap" }}>
        <button
          type="button"
          className="asa-btn asa-btn-sm"
          disabled={!dirty || busy}
          onClick={async () => {
            setBusy(true);
            await onSave(text);
            setBusy(false);
          }}
        >
          Save
        </button>
        {onDelete ? (
          <button
            type="button"
            className="asa-btn asa-btn-danger asa-btn-sm"
            style={{ marginLeft: 6 }}
            onClick={() => {
              if (window.confirm("Delete this line?")) void onDelete();
            }}
          >
            Delete
          </button>
        ) : null}
      </td>
    </tr>
  );
}

/* ------------------------------------------------- hints, feedback, model */

type Field = { key: string; label: string; options?: string[] };

function TableEditor({
  fetcher,
  table,
  fields,
  intro,
}: {
  fetcher: Fetcher;
  table: "hints" | "feedback" | "model_lines";
  fields: Field[];
  intro: string;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { status, body } = await fetcher<{ rows: Row[] }>(
      `/api/academy/admin/content?table=${table}`,
    );
    if (status === 200) setRows(body.rows);
    else setError("Could not load.");
  }, [fetcher, table]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(row: Record<string, unknown>) {
    const { status } = await fetcher("/api/academy/admin/content", {
      method: "POST",
      body: { table, row },
    });
    if (status !== 200) setError("Could not save.");
    else setError("");
    await load();
  }

  const shown = (rows ?? []).filter(
    (r) => !filter || fields.some((f) => String(r[f.key]) === filter),
  );
  const filterField = fields.find((f) => f.options);

  return (
    <div>
      <p className="asa-muted" style={{ marginTop: 0, fontSize: 14 }}>
        {intro}
      </p>
      {filterField ? (
        <select
          className="asa-input"
          style={{ width: "auto", marginBottom: 14 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All</option>
          {filterField.options!.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : null}
      <div className="asa-card" style={{ marginBottom: 16, display: "grid", gap: 8 }}>
        <strong style={{ fontSize: 14 }}>Add</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {fields.map((f) =>
            f.options ? (
              <select
                key={f.key}
                className="asa-input"
                style={{ width: "auto" }}
                value={draft[f.key] ?? ""}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              >
                <option value="">{f.label}</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                key={f.key}
                className="asa-input"
                style={{ width: 200 }}
                placeholder={f.label}
                value={draft[f.key] ?? ""}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              />
            ),
          )}
        </div>
        <textarea
          className="asa-input"
          rows={2}
          placeholder="Text"
          value={draft.text ?? ""}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
        />
        <button
          type="button"
          className="asa-btn asa-btn-sm"
          style={{ justifySelf: "start" }}
          onClick={async () => {
            if (fields.some((f) => !draft[f.key]) || !draft.text?.trim()) {
              setError("Fill in every field.");
              return;
            }
            await save(draft);
            setDraft({});
          }}
        >
          Add
        </button>
        {error ? <p style={{ color: "var(--asa-bad)", fontSize: 14, margin: 0 }}>{error}</p> : null}
      </div>
      {rows === null ? (
        <p className="asa-muted">Loading...</p>
      ) : (
        <div className="asa-card asa-scroll-x" style={{ padding: 8 }}>
          <table className="asa-table">
            <thead>
              <tr>
                {fields.map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
                <th style={{ minWidth: 280 }}>Text</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <EditableRow
                  key={r.id}
                  row={r}
                  cells={fields.map((f) => String(r[f.key] ?? ""))}
                  onSave={(text) => save({ ...r, text })}
                  onDelete={async () => {
                    await fetcher(
                      `/api/academy/admin/content?table=${table}&id=${encodeURIComponent(r.id)}`,
                      { method: "DELETE" },
                    );
                    await load();
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ weak spots */

function WeakSpots({ fetcher }: { fetcher: Fetcher }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    void (async () => {
      const { body } = await fetcher<{ rows: Row[] }>("/api/academy/admin/content?table=weak_spots");
      setRows(body.rows ?? []);
    })();
  }, [fetcher]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows ?? []) c[String(r.reaction_used)] = (c[String(r.reaction_used)] ?? 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  if (!rows) return <p className="asa-muted">Loading...</p>;
  return (
    <div>
      <p className="asa-muted" style={{ marginTop: 0, fontSize: 14 }}>
        Each entry is a moment the engine ran out of fresh lines for an author and reaction and had
        to use a backup or repeat. Add lines to the reactions at the top of this list first.
      </p>
      {counts.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {counts.map(([r, n]) => (
            <span key={r} className="asa-pill">
              {r}: {n}
            </span>
          ))}
        </div>
      ) : null}
      {rows.length === 0 ? (
        <div className="asa-card asa-muted">No weak spots yet.</div>
      ) : (
        <div className="asa-card asa-scroll-x" style={{ padding: 8 }}>
          <table className="asa-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Reaction</th>
                <th>Trainee message</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {new Date(String(r.created_at)).toLocaleString()}
                  </td>
                  <td>{r.reaction_used}</td>
                  <td style={{ fontSize: 13 }}>{r.scout_text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
