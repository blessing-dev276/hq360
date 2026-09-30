import { contextForPath, inquiryHref, readInquiryContext } from "@/lib/inquiry-context";
import { useRouterState } from "@tanstack/react-router";
import { CTAS } from "@/config/brand";
import { Eyebrow, Grain, Pill } from "./hqd/Hqd";

/** Closing call to action: a primary action and one lower-friction secondary. */
export function CtaBand({
  eyebrow = "Start here",
  title,
  body,
  primary = CTAS.primary,
  secondary,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  primary?: { label: string; to: string };
  secondary?: { label: string; to: string };
}) {
  const location = useRouterState({ select: (state) => state.location });
  const contact = inquiryHref({
    ...contextForPath(location.pathname),
    ...readInquiryContext(location.search),
  });
  return (
    <section style={{ padding: "clamp(3rem, 7vw, 6rem) 0" }}>
      <div className="hqd-cta">
        <Grain />
        <div className="hqd-wrap" style={{ paddingInline: 0 }}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="hqd-title hqd-title--h2" style={{ maxWidth: "52rem" }}>
            {title}
          </h2>
          {body ? (
            <p className="hqd-intro" style={{ maxWidth: "40rem" }}>
              {body}
            </p>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "2rem" }}>
            <Pill to={primary.to === "/contact" ? contact : primary.to} tone="orange">
              {primary.label}
            </Pill>
            {secondary ? (
              <Pill to={secondary.to === "/contact" ? contact : secondary.to} tone="ghost">
                {secondary.label}
              </Pill>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
