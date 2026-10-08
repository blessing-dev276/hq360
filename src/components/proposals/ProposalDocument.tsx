import { forwardRef, Fragment } from "react";
import { parseInline, parseProposal, type Proposal } from "@/lib/proposals";
import "./proposal.css";

function Rich({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, i) =>
        part.href ? (
          <a key={i} href={part.href} target="_blank" rel="noreferrer">
            {part.text.replace(/^https?:\/\//, "")}
          </a>
        ) : part.bold ? (
          <strong key={i}>{part.text}</strong>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

/** The branded proposal the client sees, also used for the PDF export. */
export const ProposalDocument = forwardRef<HTMLDivElement, { proposal: Proposal }>(
  function ProposalDocument({ proposal: p }, ref) {
    const blocks = parseProposal(p.body);
    const details = p.details.filter((d) => d.label.trim() && d.value.trim());
    return (
      <div className="pd" ref={ref}>
        <article className="pd-card">
          <div className="pd-stripe" />
          <header className="pd-cover">
            <div className="pd-cover-top">
              <img src="/logo-text.webp" alt="HQ360" className="pd-logo" />
              <span className="pd-tag">Private proposal</span>
            </div>
            <p className="pd-eyebrow">Proposal</p>
            <h1>{p.title || "Untitled proposal"}</h1>
            {p.client_name && (
              <p className="pd-for">
                Prepared exclusively for <strong>{p.client_name}</strong>
              </p>
            )}
            {p.subtitle && <p className="pd-subtitle">{p.subtitle}</p>}
            {details.length > 0 && (
              <dl className="pd-details">
                {details.map((d) => (
                  <div key={d.label}>
                    <dt>{d.label}</dt>
                    <dd>
                      <Rich text={d.value} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </header>

          <div className="pd-body">
            {blocks.map((b, i) => {
              switch (b.kind) {
                case "h1":
                case "h2":
                  return (
                    <h2 key={i}>
                      <Rich text={b.text} />
                    </h2>
                  );
                case "h3":
                  return (
                    <h3 key={i}>
                      <Rich text={b.text} />
                    </h3>
                  );
                case "p":
                  return (
                    <p key={i}>
                      <Rich text={b.text} />
                    </p>
                  );
                case "ul":
                case "ol": {
                  const List = b.kind;
                  return (
                    <List key={i}>
                      {b.items.map((item, j) => (
                        <li key={j}>
                          <Rich text={item} />
                        </li>
                      ))}
                    </List>
                  );
                }
                case "callout":
                  return (
                    <aside key={i} className="pd-callout">
                      <Rich text={b.text} />
                    </aside>
                  );
                case "table":
                  return (
                    <div key={i} className="pd-table-wrap">
                      <table className="pd-table">
                        <thead>
                          <tr>
                            {b.head.map((h, j) => (
                              <th key={j}>
                                <Rich text={h} />
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {b.rows.map((row, j) => (
                            <tr key={j}>
                              {row.map((cell, k) => (
                                <td key={k}>
                                  <Rich text={cell} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
              }
            })}
          </div>

          {p.prepared_by && (
            <footer className="pd-sign">
              <p className="pd-eyebrow">Prepared by</p>
              <p className="pd-sign-name">{p.prepared_by}</p>
              {p.prepared_by_role && <p className="pd-sign-role">{p.prepared_by_role}</p>}
              <a href="https://www.hq360.space" target="_blank" rel="noreferrer">
                hq360.space
              </a>
            </footer>
          )}
          {p.footer_note && <p className="pd-note">{p.footer_note}</p>}
        </article>
      </div>
    );
  },
);
