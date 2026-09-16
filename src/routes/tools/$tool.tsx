import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { FREE_TOOLS } from "@/data/free-tools";
import { Section, SectionHeader } from "@/components/site/Primitives";
import { buildSeo } from "@/lib/seo";

export const Route = createFileRoute("/tools/$tool")({
  loader: ({ params }) => {
    const tool = FREE_TOOLS.find((t) => t.slug === params.tool);
    if (!tool) throw notFound();
    return tool;
  },
  head: ({ loaderData }) =>
    buildSeo({
      title: `${loaderData?.name ?? "Free tool"} | HQ360`,
      description: loaderData?.description ?? "HQ360 free planning tools",
      path: `/tools/${loaderData?.slug ?? ""}`,
    }),
  component: ToolPage,
});

function ToolPage() {
  const tool = Route.useLoaderData();
  return <Tool key={tool.slug} tool={tool} />;
}
const input = "mt-2 w-full rounded-xl border border-border bg-background p-3 text-foreground";
function Tool({ tool }: { tool: (typeof FREE_TOOLS)[number] }) {
  const [result, setResult] = useState("");
  const [notice, setNotice] = useState("");
  const checklist = tool.actions.length > 0;
  const budget = tool.slug === "marketing-budget-planner";
  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const answers = tool.fields.map((_, i) => String(data.get(`field-${i}`) ?? "").trim());
    let output = `${tool.name}\nPrepared ${new Date().toLocaleDateString()}\n\n`;
    if (checklist) {
      output += "Self-assessment based on your answers; no external verification performed.\n\n";
      output +=
        "Already in place (self-reported)\n" +
        (tool.fields.filter((_, i) => answers[i] === "yes").join("\n") ||
          "No items confirmed yet.");
      output +=
        "\n\nNext actions\n" +
        (tool.actions
          .flatMap((action, i) =>
            answers[i] === "yes"
              ? []
              : [`${answers[i] === "unknown" ? "Verify first: " : ""}${action}`],
          )
          .join("\n") ||
          "All checklist items are confirmed. Recheck after your next significant change.");
    } else if (budget) {
      const total = Number(data.get("budget"));
      const allocation = data.get("focus") === "foundation" ? [40, 20, 20, 20] : [25, 40, 20, 15];
      const cents = Math.round(total * 100);
      let assigned = 0;
      output += `Monthly budget: ${total.toFixed(2)} ${data.get("currency")}\nPlanning allocation, not a forecast or promise of returns.\n\n`;
      output += [
        "Content & creative",
        "Distribution & advertising",
        "Website & conversion",
        "Measurement & experiments",
      ]
        .map((label, i) => {
          const amount = i === 3 ? cents - assigned : Math.round((cents * allocation[i]) / 100);
          assigned += amount;
          return `${label}: ${allocation[i]}% — ${(amount / 100).toFixed(2)} ${data.get("currency")}`;
        })
        .join("\n");
    } else if (tool.slug === "content-repurposing-planner") {
      output += `Topic: ${answers[0]}\nAudience: ${answers[1]}\nTakeaway: ${answers[2]}\nCall to action: ${answers[3]}\n\n`;
      output += [
        "Short video: open with the main audience question, explain the takeaway, close with your call to action.",
        "Carousel: introduce the problem, develop three supporting points from your source, and finish with the next step.",
        "Email: explain why this topic matters to your audience, share the takeaway and link to the full source.",
        "Text post: quote one supported point, add context and invite a relevant question.",
      ].join("\n\n");
      output +=
        "\n\nThis is an editing plan based on your brief. Check every claim against your original source before publishing.";
    } else output += tool.fields.map((label, i) => `${label}\n${answers[i]}`).join("\n\n");
    setResult(output);
    setNotice("");
  }
  function download() {
    const url = URL.createObjectURL(new Blob([result], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tool.slug}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Section>
      <div className="mx-auto max-w-3xl">
        <Link to="/tools" className="text-sm text-brand">
          ← All free tools
        </Link>
        <div className="mt-8">
          <SectionHeader
            as="h1"
            eyebrow="HQ360 / Free tools"
            title={tool.name}
            intro={tool.description}
          />
        </div>
        <p className="my-6 text-sm text-muted-foreground">
          {checklist
            ? "Answer a few questions to build your next-action checklist."
            : "Create a practical planning document you can copy or download."}{" "}
          Your answers stay in this page and are not saved after you leave.
        </p>
        <form
          onSubmit={generate}
          onChange={() => setResult("")}
          className="space-y-5 rounded-3xl border border-border bg-card p-6 sm:p-8"
        >
          {tool.fields.map((label, i) => (
            <label key={label} className="block text-sm font-medium">
              {label}
              {checklist ? (
                <select required name={`field-${i}`} defaultValue="" className={input}>
                  <option value="" disabled>
                    Choose an answer
                  </option>
                  <option value="yes">Yes</option>
                  <option value="no">Not yet</option>
                  <option value="unknown">Not sure</option>
                </select>
              ) : (
                <textarea
                  required
                  maxLength={1500}
                  name={`field-${i}`}
                  rows={2}
                  className={input}
                />
              )}
            </label>
          ))}
          {budget && (
            <>
              <label className="block">
                Monthly budget
                <input
                  required
                  name="budget"
                  type="number"
                  min="1"
                  max="100000000"
                  step="0.01"
                  className={input}
                />
              </label>
              <label className="block">
                Currency
                <select name="currency" className={input}>
                  {["USD", "GBP", "EUR", "NGN", "CAD", "AUD"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                Current priority
                <select name="focus" className={input}>
                  <option value="foundation">Build the foundations</option>
                  <option value="growth">Distribute an established offer</option>
                </select>
              </label>
              <p className="text-xs text-muted-foreground">
                Foundation split: 40 / 20 / 20 / 20%. Distribution split: 25 / 40 / 20 / 15%. These
                editable starting assumptions allocate funds across creative, distribution,
                conversion and measurement.
              </p>
            </>
          )}
          <button className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground">
            {checklist ? "Build my checklist" : "Create my plan"}
          </button>
        </form>
        {result && (
          <section
            aria-label="Your results"
            className="mt-8 rounded-3xl border border-brand/30 bg-secondary p-6"
          >
            <h2 className="font-display text-2xl" role="status">
              Your plan is ready
            </h2>
            <pre className="mt-5 whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {result}
            </pre>
            <div className="mt-6 flex flex-wrap gap-4">
              <button
                onClick={download}
                className="rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground"
              >
                Download plan
              </button>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result);
                    setNotice("Copied to clipboard.");
                  } catch {
                    setNotice("Copy unavailable. Use Download plan instead.");
                  }
                }}
                className="rounded-full border border-border px-5 py-3 text-sm"
              >
                Copy plan
              </button>
            </div>
            <p role="status" className="mt-3 text-sm">
              {notice}
            </p>
            <Link to="/contact" className="mt-5 inline-block text-sm text-brand underline">
              Talk to HQ360 about your next steps
            </Link>
          </section>
        )}
      </div>
    </Section>
  );
}
