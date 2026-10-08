import { useCallback, useEffect, useState } from "react";
import {
  api,
  AuthorCard,
  CoachingPanel,
  SessionCard,
  SUB_NAMES,
  Transcript,
  type Session,
  type Viewer,
} from "./shared";

/* ---------------------------------------------------------------- my chats */

export function MyChats({
  viewer,
  version,
  onContinue,
  onPractice,
  onChanged,
}: {
  viewer: Viewer;
  version: number;
  onContinue: (s: Session) => void;
  onPractice: () => void;
  onChanged: () => void;
}) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const { body } = await api<{ sessions: Session[] }>("/api/academy/sessions");
    setSessions(body.sessions ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load, version]);

  const open = sessions?.find((s) => s.id === openId) ?? null;

  async function remove(id: string) {
    if (!confirmDelete) return setConfirmDelete(true);
    await api(`/api/academy/sessions/${id}`, { method: "DELETE" });
    setConfirmDelete(false);
    setOpenId(null);
    await load();
    onChanged();
  }

  async function share(id: string) {
    const { status, body } = await api("/api/academy/demos", {
      method: "POST",
      body: { sessionId: id },
    });
    setNotice(status === 200 ? "Shared to Demos." : (body.message ?? "Could not share."));
  }

  return (
    <div className="asa-wrap" style={{ padding: "32px 16px 64px" }}>
      <h2 style={{ fontSize: 32, margin: "0 0 18px" }}>My chats</h2>
      {sessions === null ? (
        <p className="asa-muted">Loading...</p>
      ) : sessions.length === 0 ? (
        <div className="asa-card" style={{ textAlign: "center", padding: 40 }}>
          <h3 style={{ marginTop: 0 }}>No chats yet</h3>
          <p className="asa-muted">
            Your practice conversations will appear here, with their scores and coaching.
          </p>
          <button type="button" className="asa-btn" onClick={onPractice}>
            Start a practice chat
          </button>
        </div>
      ) : (
        <div className="asa-cards">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              selected={s.id === openId}
              onClick={() => {
                setOpenId(s.id === openId ? null : s.id);
                setConfirmDelete(false);
                setNotice("");
              }}
            />
          ))}
        </div>
      )}

      {open ? (
        <SessionDetail session={open}>
          {!open.ended ? (
            <button type="button" className="asa-btn" onClick={() => onContinue(open)}>
              Continue chat
            </button>
          ) : null}
          {viewer.role === "trainer" && open.ended ? (
            <button
              type="button"
              className="asa-btn asa-btn-ghost"
              onClick={() => void share(open.id)}
            >
              Share as demo
            </button>
          ) : null}
          <button
            type="button"
            className="asa-btn asa-btn-danger"
            onClick={() => void remove(open.id)}
          >
            {confirmDelete ? "Click again to delete" : "Delete"}
          </button>
          {notice ? <span className="asa-muted">{notice}</span> : null}
        </SessionDetail>
      ) : null}
    </div>
  );
}

export function SessionDetail({
  session,
  children,
}: {
  session: Session;
  children?: React.ReactNode;
}) {
  return (
    <div className="asa-practice" style={{ paddingBottom: 0 }}>
      <AuthorCard session={session} />
      <div>
        <Transcript session={session} />
        {session.coaching ? <CoachingPanel coaching={session.coaching} /> : null}
        {children ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              marginTop: 16,
            }}
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- demos */

type Demo = { id: string; session: Session; shared_at: string };

export function Demos({ viewer }: { viewer: Viewer }) {
  const [demos, setDemos] = useState<Demo[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { body } = await api<{ demos: Demo[] }>("/api/academy/demos");
    setDemos(body.demos ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = demos?.find((d) => d.id === openId) ?? null;

  return (
    <div className="asa-wrap" style={{ padding: "32px 16px 64px" }}>
      <h2 style={{ fontSize: 32, margin: "0 0 6px" }}>Demo conversations</h2>
      <p className="asa-muted" style={{ margin: "0 0 20px" }}>
        Model conversations chosen by the trainer to show how to converse and convert. Study what
        was said at each turn.
      </p>
      {demos === null ? (
        <p className="asa-muted">Loading...</p>
      ) : demos.length === 0 ? (
        <div className="asa-card asa-muted">No demos have been shared yet.</div>
      ) : (
        <div className="asa-cards">
          {demos.map((d) => (
            <SessionCard
              key={d.id}
              session={d.session}
              selected={d.id === openId}
              onClick={() => setOpenId(d.id === openId ? null : d.id)}
            />
          ))}
        </div>
      )}
      {open ? (
        <SessionDetail session={open.session}>
          {viewer.role === "trainer" ? (
            <button
              type="button"
              className="asa-btn asa-btn-danger"
              onClick={async () => {
                await api(`/api/academy/demos/${open.id}`, { method: "DELETE" });
                setOpenId(null);
                await load();
              }}
            >
              Remove from demos
            </button>
          ) : null}
        </SessionDetail>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------- admin */

type Trainee = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  sessionsThisWeek: number;
  totalSessions: number;
  averageScore: number | null;
  weakest: string | null;
};

export type Fetcher = <T>(
  url: string,
  init?: { method?: string; body?: unknown },
) => Promise<{ status: number; body: T }>;

/**
 * Trainee overview. `fetcher` lets /admin use its passphrase cookie while the
 * academy uses the trainer's Supabase login.
 */
export function TraineesAdmin({ fetcher = api as Fetcher }: { fetcher?: Fetcher }) {
  const [data, setData] = useState<{ trainees: Trainee[] } | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Trainee | null>(null);
  const [chats, setChats] = useState<Session[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [roleBusy, setRoleBusy] = useState("");
  const [roleNotice, setRoleNotice] = useState("");

  async function setRole(t: Trainee, role: "trainer" | "trainee") {
    const who = t.name || t.email || "this person";
    if (
      !window.confirm(
        role === "trainer"
          ? `Make ${who} a trainer? They'll get Trainer tools: every trainee's chats, scores and the content editors.`
          : `Remove trainer access from ${who}?`,
      )
    )
      return;
    setRoleBusy(t.id);
    setRoleNotice("");
    const { status, body } = await fetcher<{ message?: string }>("/api/academy/admin/trainees", {
      method: "PATCH",
      body: { id: t.id, role },
    });
    setRoleBusy("");
    if (status === 200) {
      setData((d) =>
        d ? { trainees: d.trainees.map((x) => (x.id === t.id ? { ...x, role } : x)) } : d,
      );
      setRoleNotice(
        role === "trainer"
          ? `${who} is now a trainer. They'll see Trainer tools next time they open the Academy.`
          : `${who} is now a trainee.`,
      );
    } else setRoleNotice(body.message || "Could not update the role.");
  }

  useEffect(() => {
    void (async () => {
      const { status, body } = await fetcher<{ trainees: Trainee[] }>(
        "/api/academy/admin/trainees",
      );
      if (status === 200) setData(body);
      else setError(status === 403 ? "Trainer access only." : "Could not load trainees.");
    })();
  }, [fetcher]);

  async function pick(t: Trainee) {
    setSelected(t);
    setChats(null);
    setOpenId(null);
    const { body } = await fetcher<{ sessions: Session[] }>(
      `/api/academy/sessions?user=${encodeURIComponent(t.id)}`,
    );
    setChats(body.sessions ?? []);
  }

  const open = chats?.find((s) => s.id === openId) ?? null;

  if (error) return <p className="asa-muted">{error}</p>;
  if (!data) return <p className="asa-muted">Loading trainees...</p>;

  return (
    <div>
      <div className="asa-tiles">
        <div className="asa-card asa-tile">
          <b>{data.trainees.length}</b>
          people signed up
        </div>
        <div className="asa-card asa-tile">
          <b>{data.trainees.reduce((n, t) => n + t.totalSessions, 0)}</b>
          practice sessions
        </div>
        <div className="asa-card asa-tile">
          <b>
            {(() => {
              const scored = data.trainees.filter((t) => t.averageScore !== null);
              return scored.length
                ? Math.round(scored.reduce((n, t) => n + (t.averageScore ?? 0), 0) / scored.length)
                : "-";
            })()}
          </b>
          team average score
        </div>
      </div>
      {roleNotice ? (
        <p role="status" style={{ fontSize: 14 }}>
          {roleNotice}
        </p>
      ) : null}
      <p className="asa-muted" style={{ fontSize: 13 }}>
        Someone appears here after they sign in to the Academy once. Use Make trainer to give them
        Trainer tools.
      </p>
      <div className="asa-card asa-scroll-x" style={{ padding: 8 }}>
        <table className="asa-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>This week</th>
              <th>Total</th>
              <th>Average</th>
              <th>Weakest</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {data.trainees.map((t) => (
              <tr key={t.id} className="asa-row-link" onClick={() => void pick(t)}>
                <td>
                  {t.name || "Unnamed"}
                  {t.role === "trainer" ? (
                    <span className="asa-pill" style={{ marginLeft: 6 }}>
                      trainer
                    </span>
                  ) : null}
                </td>
                <td>{t.email}</td>
                <td>{t.sessionsThisWeek}</td>
                <td>{t.totalSessions}</td>
                <td>{t.averageScore ?? "-"}</td>
                <td>{t.weakest ? SUB_NAMES[t.weakest] : "-"}</td>
                <td>
                  <button
                    type="button"
                    className={`asa-btn asa-btn-sm${t.role === "trainer" ? " asa-btn-ghost" : ""}`}
                    disabled={roleBusy === t.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      void setRole(t, t.role === "trainer" ? "trainee" : "trainer");
                    }}
                  >
                    {roleBusy === t.id
                      ? "Saving..."
                      : t.role === "trainer"
                        ? "Remove trainer"
                        : "Make trainer"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontSize: 22 }}>{selected.name || selected.email}'s chats</h3>
          {chats === null ? (
            <p className="asa-muted">Loading...</p>
          ) : chats.length === 0 ? (
            <p className="asa-muted">No chats yet.</p>
          ) : (
            <div className="asa-cards">
              {chats.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  selected={s.id === openId}
                  onClick={() => setOpenId(s.id === openId ? null : s.id)}
                />
              ))}
            </div>
          )}
          {open ? <SessionDetail session={open} /> : null}
        </div>
      ) : null}
    </div>
  );
}
