import { LoadingRegion, Skeleton, SkeletonText } from "@/components/ui/skeleton";

/** Mirrors the published audit report: hero, snapshot numbers, executive
 *  summary and finding cards (title, badge, text, evidence, action). */
export function AuditReportSkeleton() {
  return (
    <div className="dark" style={{ background: "#0b0b0b", minHeight: "100vh" }}>
      <LoadingRegion label="Preparing your private audit" delay={120}>
        <div style={{ maxWidth: "72rem", margin: "0 auto", padding: "4rem 1.25rem" }}>
          <Skeleton width={180} height={11} />
          <Skeleton width="58%" height={44} style={{ marginTop: 22 }} />
          <Skeleton width="38%" height={22} style={{ marginTop: 14 }} />
          <Skeleton width={160} height={11} style={{ marginTop: 18 }} />
          <div style={{ maxWidth: "40rem", marginTop: 28 }}>
            <SkeletonText lines={3} lineHeight={14} />
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))",
              marginTop: 48,
            }}
          >
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="hq-skel-card">
                <Skeleton width="45%" height={28} />
                <Skeleton width="75%" height={10} />
              </div>
            ))}
          </div>

          <Skeleton width={220} height={24} style={{ marginTop: 56 }} />
          <div style={{ marginTop: 18 }}>
            <SkeletonText lines={4} lineHeight={13} />
          </div>

          <div style={{ display: "grid", gap: 16, marginTop: 48 }}>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="hq-skel-card" style={{ padding: 24 }}>
                <span className="hq-skel-row" style={{ justifyContent: "space-between" }}>
                  <Skeleton width="48%" height={20} />
                  <Skeleton variant="pill" width={92} height={24} />
                </span>
                <SkeletonText lines={3} />
                <Skeleton height={110} radius={14} />
                <Skeleton width="70%" height={12} />
              </div>
            ))}
          </div>
        </div>
      </LoadingRegion>
    </div>
  );
}
