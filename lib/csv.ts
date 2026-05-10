/**
 * Minimal CSV writer — RFC 4180-ish: quotes when needed, escapes embedded quotes.
 * Used for product/inventory/report exports. Don't use for round-tripping with Excel
 * macros or non-UTF8 encodings; this is plain UTF-8 text/csv.
 */
export function toCSV(
  rows: Array<Record<string, string | number | boolean | null | undefined | Date>>,
  columns: Array<{ key: string; header: string }>,
): string {
  const head = columns.map((c) => quote(c.header)).join(",");
  const body = rows.map((r) =>
    columns
      .map((c) => {
        const v = r[c.key];
        if (v === null || v === undefined) return "";
        if (v instanceof Date) return quote(v.toISOString());
        return quote(String(v));
      })
      .join(","),
  );
  return [head, ...body].join("\r\n");
}

function quote(s: string): string {
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
