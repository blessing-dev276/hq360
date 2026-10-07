import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Download, FileText } from "lucide-react";
import { QuoteDocument } from "@/components/quotes/QuoteDocument";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import type { Quote } from "@/lib/quotes";

export const Route = createFileRoute("/quote/$token")({
  head: () => ({
    meta: [
      { title: "Your quote | HQ360" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: QuotePage,
});

function QuotePage() {
  const { token } = Route.useParams();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "pdf" | "png">("");
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/public/quote?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "This quote could not be found.");
        setQuote(data.item);
      })
      .catch((e: Error) => setError(e.message));
  }, [token]);

  async function save(kind: "pdf" | "png") {
    if (!docRef.current || !quote) return;
    setBusy(kind);
    try {
      const m = await import("@/lib/quote-export");
      const title = quote.project_title || "quote";
      await (kind === "pdf"
        ? m.downloadQuotePdf(docRef.current, title)
        : m.downloadQuoteImage(docRef.current, title));
    } finally {
      setBusy("");
    }
  }

  if (error)
    return (
      <div className="qd" style={{ minHeight: "100vh" }}>
        <div className="qd-card" style={{ maxWidth: 560 }}>
          <div className="qd-stripe" />
          <div className="qd-inner" style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 22, margin: 0 }}>Quote unavailable</h1>
            <p style={{ color: "#5f6368" }}>{error}</p>
          </div>
        </div>
      </div>
    );
  if (!quote)
    return (
      <div className="qd" style={{ minHeight: "100vh" }}>
        <LoadingRegion label="Loading your quote" className="qd-card qd-inner">
          <Skeleton width={120} height={36} />
          <Skeleton width="55%" height={30} style={{ marginTop: 28 }} />
          <Skeleton width="80%" height={12} style={{ marginTop: 14 }} />
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(3,1fr)",
              marginTop: 28,
            }}
          >
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={240} radius={18} />
            ))}
          </div>
        </LoadingRegion>
      </div>
    );
  return (
    <div style={{ minHeight: "100vh", background: "#f4f2ef" }}>
      <div className="qd-actions">
        <button type="button" onClick={() => void save("pdf")} disabled={Boolean(busy)}>
          <FileText size={15} /> {busy === "pdf" ? "Preparing PDF…" : "Download PDF"}
        </button>
        <button type="button" onClick={() => void save("png")} disabled={Boolean(busy)}>
          <Download size={15} /> {busy === "png" ? "Preparing…" : "Save image"}
        </button>
      </div>
      <QuoteDocument quote={quote} ref={docRef} />
    </div>
  );
}
