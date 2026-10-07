import { ChevronDown } from "lucide-react";

/** Native disclosure keeps every answer in SSR and works without JavaScript. */
export function FaqSection({
  faqs,
  idPrefix = "faq",
}: {
  faqs: { q: string; a: string }[];
  idPrefix?: string;
}) {
  if (!faqs.length) return null;
  return (
    <div className="w-full">
      {faqs.map((item, idx) => (
        <details key={item.q} name={idPrefix} id={`${idPrefix}-${idx}`} className="group border-b">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-sans text-base font-medium hover:underline [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
            />
          </summary>
          <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
