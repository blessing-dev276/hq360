// Run after bun run build. Imports the DEPLOYED artifacts, not source files.
import { globSync, cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const sandbox = mkdtempSync(join(tmpdir(), "hq-report-bundle-"));
cpSync(".vercel/output/functions/__server.func", sandbox, { recursive: true });
const data = {
  author: { name: "Export QA" },
  book: { title: "Report packaging check", normalized_title: "report packaging check" },
  preparedDate: "September 17, 2026",
  preparedByStaffName: null,
  executiveAssessment: null,
  strengths: [],
  findings: [],
  readerJourney: [],
  comparables: [],
  moves: [],
  roadmap: [],
  evidenceAssets: [],
  sourcesReviewed: [],
};
for (const kind of ["pdf", "image"]) {
  const path = globSync(join(sandbox, "_ssr", `${kind}-report-*.mjs`))[0];
  assert(path, `${kind} renderer was emitted`);
  const mod = await import(pathToFileURL(path).href);
  const bytes = await mod[kind === "pdf" ? "renderAuditPdf" : "renderAuditImage"](data);
  assert(bytes.length > 1000);
  assert.equal(
    bytes.subarray(0, kind === "pdf" ? 4 : 8).toString("hex"),
    kind === "pdf" ? "25504446" : "89504e470d0a1a0a",
  );
  console.log(`${kind}: valid file, ${bytes.length} bytes, isolated deployment imports passed`);
}
