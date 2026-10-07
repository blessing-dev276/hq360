/** Presentation only: keep the original research and its evidence in the audit. */
export function reportBrand(text: string): string {
  return text.replace(/\bhq360\b/gi, "HQ360");
}

export function sectionNarrative(content: string): { text: string; sources: string[] } {
  const sources: string[] = [];
  let skip = false;
  const paragraphs: string[] = [];
  for (const block of content.split(/\n\s*\n/)) {
    if (/^\s*Source[ _]Urls\s*:/i.test(block)) {
      skip = true;
      sources.push(...(block.match(/https?:\/\/[^\s]+/g) ?? []));
    } else if (/^\s*Evidence\s*:/i.test(block)) {
      skip = true;
    } else if (/^\s*What[ _]We[ _]Found\s*:/i.test(block)) {
      skip = false;
      paragraphs.push(block.replace(/^\s*What[ _]We[ _]Found\s*:\s*/i, ""));
    } else if (skip && /^https?:\/\/\S+\s*$/.test(block.trim())) {
      sources.push(block.trim());
    } else {
      skip = false;
      paragraphs.push(block);
    }
  }
  return { text: reportBrand(paragraphs.join("\n\n").trim()), sources: [...new Set(sources)] };
}
