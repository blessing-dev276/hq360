import { Download, ExternalLink, FileText, Mail } from "lucide-react";
import { STATUS_LABEL, type ClientSnapshot } from "@/lib/trackers/core";
import "./tracker-page.css";

type Item = ClientSnapshot["items"][number];
type FileRef = Item["files"][number];

const dateLabel = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const sizeLabel = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function Ring({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="trk-ring" role="img" aria-label={`Overall progress ${value} percent`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={r} className="trk-ring-track" />
        <circle
          cx="60"
          cy="60"
          r={r}
          className="trk-ring-value"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
        />
      </svg>
      <span>
        <b>{value}%</b>
        <small>overall</small>
      </span>
    </div>
  );
}

/** The client's progress page. `fileHref` is null in the expert's preview. */
export function TrackerView({
  page,
  fileHref,
}: {
  page: ClientSnapshot;
  fileHref: ((file: FileRef, mode: "view" | "download" | "play") => string) | null;
}) {
  return (
    <div className="trk">
      <header className="trk-head">
        <div>
          <p className="trk-eyebrow">Private progress page</p>
          <h1>{page.projectTitle || page.clientName}</h1>
          <p className="trk-meta">
            {page.clientName}
            {page.packageName ? ` · ${page.packageName}` : ""}
          </p>
          <p className="trk-meta">Last updated {dateLabel(page.lastUpdated)}</p>
        </div>
        <Ring value={page.overall} />
      </header>
      <p className="trk-note">The overall figure counts the items in your package. Free bonus items are extra.</p>

      <section aria-labelledby="trk-items">
        <h2 id="trk-items">Your package</h2>
        <ol className="trk-items">
          {page.items.map((item) => (
            <ItemCard key={item.id} item={item} fileHref={fileHref} />
          ))}
        </ol>
      </section>

      <section aria-labelledby="trk-log" className="trk-log">
        <h2 id="trk-log">Updates</h2>
        {page.log.length ? (
          <ol>
            {page.log.map((entry, index) => (
              <li key={`${entry.date}-${index}`}>
                <time dateTime={entry.date}>{dateLabel(entry.date)}</time>
                <p>{entry.text}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="trk-meta">Updates will appear here.</p>
        )}
      </section>

      {page.expert.email && (
        <section className="trk-contact">
          <p>Questions about your project?</p>
          <a className="trk-button" href={`mailto:${page.expert.email}`}>
            <Mail size={16} aria-hidden="true" /> Email {page.expert.name}
          </a>
        </section>
      )}
      <footer className="trk-footer">
        This page records anonymous visit counts so your expert knows updates have been seen.
      </footer>
    </div>
  );
}

function ItemCard({ item, fileHref }: { item: Item; fileHref: Parameters<typeof TrackerView>[0]["fileHref"] }) {
  const highlightId = item.blocks.highlight?.imageFileId;
  const highlightFile = item.files.find((f) => f.id === highlightId);
  const images = item.files.filter((f) => f.kind === "image" && f.id !== highlightId);
  const videos = item.files.filter((f) => f.kind === "video");
  const docs = item.files.filter((f) => f.kind === "pdf" || f.kind === "other");
  const href = (file: FileRef, mode: "view" | "download" | "play") => fileHref?.(file, mode) ?? undefined;
  return (
    <li className={`trk-item trk-${item.status}`}>
      <div className="trk-item-head">
        <h3>{item.title}</h3>
        <span className="trk-status">{STATUS_LABEL[item.status]}</span>
        {item.isFreeBonus && <span className="trk-bonus">Free bonus</span>}
      </div>
      <div
        className="trk-bar"
        role="progressbar"
        aria-label={`${item.title} progress`}
        aria-valuenow={item.progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${item.progress}%` }} />
      </div>
      <p className="trk-progress-label">{item.progress}%</p>
      {item.description && <p>{item.description}</p>}

      {item.blocks.highlight && (
        <div className="trk-highlight">
          <p>{item.blocks.highlight.text}</p>
          {highlightFile && fileHref && (
            <a href={href(highlightFile, "view")} target="_blank" rel="noreferrer">
              <img src={href(highlightFile, "view")} alt={item.blocks.highlight.text} loading="lazy" />
            </a>
          )}
        </div>
      )}

      {item.blocks.checklist?.length ? (
        <ul className="trk-checklist">
          {item.blocks.checklist.map((entry, index) => (
            <li key={index} data-done={entry.done}>
              <span aria-hidden="true">{entry.done ? "✓" : ""}</span>
              {entry.text}
              <span className="trk-sr">{entry.done ? " (done)" : " (to do)"}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {item.blocks.lists?.length ? (
        <div className="trk-table-wrap">
          <table className="trk-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">List</th>
                <th scope="col">Position</th>
              </tr>
            </thead>
            <tbody>
              {item.blocks.lists.map((list, index) => (
                <tr key={index}>
                  <td>{String(index + 1).padStart(2, "0")}</td>
                  <td>
                    {list.link ? (
                      <a href={list.link} target="_blank" rel="noopener noreferrer nofollow">
                        {list.name}
                      </a>
                    ) : (
                      list.name
                    )}
                  </td>
                  <td>{list.position || "To be tracked"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {images.length > 0 && (
        <div className="trk-gallery">
          {images.map((file) => (
            <figure key={file.id}>
              {fileHref ? (
                <img src={href(file, "view")} alt={file.filename} loading="lazy" />
              ) : (
                <div className="trk-placeholder">Image: {file.filename}</div>
              )}
              <figcaption>
                <a href={href(file, "download")} download>
                  <Download size={14} aria-hidden="true" /> Download
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {videos.map((file) => (
        <figure key={file.id} className="trk-video">
          {fileHref ? (
            <video
              src={href(file, "play")}
              controls
              playsInline
              preload="none"
              aria-label={file.filename}
            />
          ) : (
            <div className="trk-placeholder">Video: {file.filename}</div>
          )}
          <figcaption>
            <a href={href(file, "download")} download>
              <Download size={14} aria-hidden="true" /> Download video ({sizeLabel(file.size)})
            </a>
          </figcaption>
        </figure>
      ))}

      {docs.map((file) => (
        <a key={file.id} className="trk-file" href={href(file, "download")} download>
          <FileText size={16} aria-hidden="true" /> {file.filename} <small>{sizeLabel(file.size)}</small>
        </a>
      ))}

      {item.blocks.button && (
        <a className="trk-button" href={item.blocks.button.url} target="_blank" rel="noopener noreferrer">
          {item.blocks.button.label} <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
    </li>
  );
}
