import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Eye, Globe2, RefreshCw, Users } from "lucide-react";

type Count = { key: string; count: number };
type Stats = {
  days: number;
  views: number;
  visitors: number;
  daily: { date: string; views: number; visitors: number }[];
  countries: Count[];
  pages: Count[];
  referrers: Count[];
  devices: Count[];
  recent: { at: string; path: string; country: string | null; device: string | null }[];
};

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function flag(code: string) {
  return /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : "🌐";
}
function countryName(code: string) {
  if (!code) return "Unknown";
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

function Bars({
  items,
  total,
  label,
}: {
  items: Count[];
  total: number;
  label: (k: string) => string;
}) {
  if (!items.length) return <p className="admin-empty">No data yet.</p>;
  return (
    <ul style={{ display: "grid", gap: 10, padding: "0 25px 22px" }}>
      {items.map(({ key, count }) => (
        <li key={key || "unknown"}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, gap: 12 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {label(key)}
            </span>
            <strong className="admin-numeric">{count}</strong>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 99,
              background: "var(--color-secondary)",
              marginTop: 5,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.max(3, (count / Math.max(1, total)) * 100)}%`,
                borderRadius: 99,
                background: "var(--color-brand)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function VisitorsAdmin() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/visitors?days=${days}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load visitor stats.");
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load visitor stats.");
    } finally {
      setLoading(false);
    }
  }, [days]);
  useEffect(() => {
    void load();
  }, [load]);

  const peak = Math.max(1, ...(stats?.daily.map((d) => d.views) ?? [1]));

  return (
    <>
      <div className="admin-payment-toolbar">
        <div className="admin-segmented">
          {[7, 30, 90].map((value) => (
            <button
              key={value}
              className={days === value ? "active" : ""}
              onClick={() => setDays(value)}
            >
              Last {value} days
            </button>
          ))}
        </div>
        <button
          className="admin-icon-button"
          aria-label="Refresh"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      {error && (
        <div className="admin-alert" role="alert">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      <div className="admin-stats">
        {[
          {
            label: "Visitors",
            value: stats?.visitors,
            icon: Users,
            note: "Unique browser sessions",
          },
          { label: "Page views", value: stats?.views, icon: Eye, note: "Every page opened" },
          {
            label: "Countries",
            value: stats?.countries.filter((c) => c.key).length,
            icon: Globe2,
            note: stats?.countries[0]?.key
              ? `Top: ${countryName(stats.countries[0].key)}`
              : "Where visitors are",
          },
        ].map(({ label, value, icon: Icon, note }) => (
          <div className="admin-stat" key={label}>
            <div>
              {label}
              <Icon size={18} />
            </div>
            <strong>{loading || value === undefined ? "—" : value.toLocaleString()}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>

      <section className="admin-panel" style={{ marginBottom: 25 }}>
        <div className="admin-panel-heading">
          <div>
            <h2>Daily traffic</h2>
            <p>Page views per day</p>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 3,
            height: 140,
            padding: "0 25px 22px",
          }}
        >
          {stats?.daily.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.views} views, ${d.visitors} visitors`}
              style={{
                flex: 1,
                height: `${Math.max(2, (d.views / peak) * 100)}%`,
                borderRadius: 3,
                background: d.views ? "var(--color-brand)" : "var(--color-secondary)",
              }}
            />
          ))}
        </div>
      </section>

      <div className="admin-overview-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Visitors by country</h2>
              <p>Each visitor counted once</p>
            </div>
          </div>
          <Bars
            items={stats?.countries ?? []}
            total={stats?.visitors ?? 1}
            label={(k) => `${flag(k)}  ${countryName(k)}`}
          />
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Top pages</h2>
              <p>Most viewed</p>
            </div>
          </div>
          <Bars items={stats?.pages ?? []} total={stats?.views ?? 1} label={(k) => k} />
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Where they came from</h2>
              <p>Referring sites (direct visits not shown)</p>
            </div>
          </div>
          <Bars items={stats?.referrers ?? []} total={stats?.views ?? 1} label={(k) => k} />
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Devices</h2>
            </div>
          </div>
          <Bars
            items={stats?.devices ?? []}
            total={stats?.views ?? 1}
            label={(k) => (k ? k[0]!.toUpperCase() + k.slice(1) : "Unknown")}
          />
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Latest visits</h2>
          </div>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Page</th>
                <th>Country</th>
                <th>Device</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recent.map((r, i) => (
                <tr key={`${r.at}-${i}`}>
                  <td>{new Date(r.at).toLocaleString("en-GB")}</td>
                  <td>{r.path}</td>
                  <td>
                    {flag(r.country ?? "")} {countryName(r.country ?? "")}
                  </td>
                  <td>{r.device ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
