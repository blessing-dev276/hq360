/** Public probes cannot establish source-IP access; review WAF logs separately. */
const base = (process.argv[2] || "https://www.hq360.space").replace(/\/$/, "");
const response = await fetch("https://openai.com/searchbot.json");
if (!response.ok) throw new Error(`OpenAI IP feed returned ${response.status}`);
const feed = await response.json();
console.log("Official OAI-SearchBot ranges (compare with hosting firewall rules):");
console.log(JSON.stringify(feed, null, 2));
for (const path of ["/", "/robots.txt", "/sitemap.xml", "/capabilities", "/contact"]) {
  const result = await fetch(base + path, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)",
    },
    signal: AbortSignal.timeout(20_000),
  });
  console.log(
    `${path}: ${result.status}; server=${result.headers.get("server")}; x-robots-tag=${result.headers.get("x-robots-tag") || "none"}`,
  );
  await result.body?.cancel();
}
console.log(
  "These probes originate from this machine, not OpenAI's IP space. Confirm real crawler access in hosting request logs; a user-agent string is not identity verification.",
);
