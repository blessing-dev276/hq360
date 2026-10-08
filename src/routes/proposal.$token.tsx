import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FileText, Printer } from "lucide-react";
import { ProposalDocument } from "@/components/proposals/ProposalDocument";
import type { Proposal } from "@/lib/proposals";

export const Route = createFileRoute("/proposal/$token")({
  head: () => ({
    meta: [
      { title: "Your proposal | HQ360" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ProposalPage,
});

function ProposalPage() {
  const { token } = Route.useParams();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/public/proposal?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "This proposal could not be found.");
        setProposal(data.item);
      })
      .catch((e: Error) => setError(e.message));
  }, [token]);

  async function pdf() {
    if (!docRef.current || !proposal) return;
    setBusy(true);
    try {
      const m = await import("@/lib/quote-export");
      await m.downloadQuotePdf(docRef.current, proposal.title || "proposal");
    } finally {
      setBusy(false);
    }
  }

  if (error || !proposal)
    return (
      <div className="pd" style={{ minHeight: "100vh" }}>
        <div className="pd-card" style={{ maxWidth: 560, padding: 40, textAlign: "center" }}>
          {error ? (
            <>
              <h1 style={{ fontSize: 22, margin: 0 }}>Proposal unavailable</h1>
              <p style={{ color: "#5f6368" }}>{error}</p>
            </>
          ) : (
            <p style={{ color: "#5f6368", margin: 0 }}>Loading your proposal…</p>
          )}
        </div>
      </div>
    );
  return (
    <div style={{ minHeight: "100vh", background: "#f4f2ef" }}>
      <div className="pd-actions">
        <button type="button" className="primary" onClick={() => void pdf()} disabled={busy}>
          <FileText size={15} /> {busy ? "Preparing PDF…" : "Download PDF"}
        </button>
        <button type="button" onClick={() => window.print()}>
          <Printer size={15} /> Print
        </button>
      </div>
      <ProposalDocument proposal={proposal} ref={docRef} />
    </div>
  );
}
