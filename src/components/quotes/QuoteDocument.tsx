import { forwardRef } from "react";
import { Check, Clock } from "lucide-react";
import { discountPercent, formatPrice, longDate, quoteReference, type Quote } from "@/lib/quotes";
import "./quote.css";

/** The branded HQ360 quote. Used for the editor preview, the public link and
 *  PDF/PNG export, so all three always match. */
export const QuoteDocument = forwardRef<HTMLDivElement, { quote: Quote }>(function QuoteDocument(
  { quote },
  ref,
) {
  const packages = quote.packages.filter((p) => p.name.trim());
  const cols = Math.min(Math.max(packages.length, 1), 3);
  return (
    <div className="qd" ref={ref}>
      <div className="qd-card">
        <div className="qd-stripe" aria-hidden="true" />
        <div className="qd-inner">
          <header className="qd-head">
            <img src="/logo-text.webp" alt="HQ360" width={120} height={60} className="qd-logo" />
            <div className="qd-ref">
              Quote
              <strong>{quoteReference(quote)}</strong>
            </div>
          </header>

          <section className="qd-hero">
            {quote.client_name && <p className="qd-for">Prepared for {quote.client_name}</p>}
            <h1>{quote.project_title || "Project quote"}</h1>
            {quote.intro && <p className="qd-intro">{quote.intro}</p>}
          </section>

          {packages.length > 0 && (
            <section
              className="qd-packages"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {packages.map((pkg, i) => (
                <article key={i} className={`qd-pkg${pkg.recommended ? " is-recommended" : ""}`}>
                  {pkg.recommended && <span className="qd-badge">Recommended</span>}
                  <h2>{pkg.name}</h2>
                  {discountPercent(pkg) !== null && (
                    <p className="qd-was">
                      <s>{formatPrice(pkg.original_price!, quote.currency)}</s>
                      <span className="qd-save">Save {discountPercent(pkg)}%</span>
                    </p>
                  )}
                  <p className="qd-price">{formatPrice(pkg.price, quote.currency)}</p>
                  {pkg.delivery && (
                    <p className="qd-delivery">
                      <Clock size={14} aria-hidden="true" /> {pkg.delivery}
                    </p>
                  )}
                  {pkg.features.filter(Boolean).length > 0 && (
                    <ul>
                      {pkg.features.filter(Boolean).map((f, j) => (
                        <li key={j}>
                          <Check size={15} aria-hidden="true" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </section>
          )}

          {quote.notes && (
            <section className="qd-notes">
              <h3>Notes &amp; terms</h3>
              <p>{quote.notes}</p>
            </section>
          )}

          <footer className="qd-foot">
            <div>
              <span>Prepared by</span>
              <strong>{quote.prepared_by || "HQ360"}</strong>
            </div>
            {quote.valid_until && (
              <div>
                <span>Valid until</span>
                <strong>{longDate(quote.valid_until)}</strong>
              </div>
            )}
            <div>
              <span>Questions</span>
              <strong>ceo@hq360.space</strong>
            </div>
          </footer>
        </div>
      </div>
      <p className="qd-site">HQ360 · hq360.space</p>
    </div>
  );
});
