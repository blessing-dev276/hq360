import { useEffect, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";

/** The expert's personal Author Visibility Check link: requests made through
 *  it are routed to this expert's Audit workspace. */
export function ExpertAuditLink() {
  const [slug, setSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    fetch("/api/expert/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { profile?: { slug?: string } } | null) => setSlug(data?.profile?.slug ?? null))
      .catch(() => {});
  }, []);
  if (!slug) return null;
  const url = `${window.location.origin}/tools/author-visibility-audit?expert=${encodeURIComponent(slug)}`;
  return (
    <section className="admin-setup" style={{ marginBottom: "1.5rem" }}>
      <span className="admin-action-icon">
        <Link2 size={20} />
      </span>
      <div style={{ minWidth: 0 }}>
        <strong>Your audit link</strong>
        <p>
          Send this to an author. Their free visibility check request comes straight to you here.
        </p>
        <p style={{ overflowWrap: "anywhere", opacity: 0.85 }}>{url}</p>
      </div>
      <button
        type="button"
        className="admin-button admin-button-primary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
          } catch {
            window.prompt("Copy your audit link:", url);
            return;
          }
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </section>
  );
}
