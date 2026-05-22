/**
 * Small CSV helpers used by export buttons. Follows RFC 4180 quoting:
 * a value is wrapped in double quotes only when it contains a comma,
 * a double-quote, a CR, or an LF — and any embedded double-quotes are
 * escaped by doubling them. Rows are joined with `\r\n` so the file
 * opens cleanly in Excel on Windows as well as on the Mac.
 */

const SPECIAL = /[",\r\n]/;

function encodeField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (!SPECIAL.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  const lines: string[] = [];
  lines.push(headers.map(encodeField).join(','));
  for (const row of rows) {
    lines.push(row.map(encodeField).join(','));
  }
  return lines.join('\r\n');
}

/**
 * Trigger a browser download for the given CSV string. No-op outside
 * the browser (Bun's test env has no `document`); the pure
 * string-builder above is what unit tests cover.
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  // BOM keeps Excel honest about UTF-8.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
