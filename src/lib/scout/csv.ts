/** Minimal CSV serializer -- no dependency exists elsewhere in this repo,
 * and RFC 4180 quoting is small enough not to justify adding one. */
export function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  rows: Record<string, unknown>[],
  columns: { key: string; header: string }[],
): string {
  const header = columns.map((c) => toCsvCell(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => toCsvCell(row[c.key])).join(","));
  return [header, ...body].join("\r\n");
}
