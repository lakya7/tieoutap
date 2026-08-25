/** CSV loading for Phase 1, browser-friendly: parses CSV text (no filesystem
 * access here). Statement CSV is pre-parsed (hand-typed from a PDF). */
import type { LedgerLine, StatementLine } from "./models";
import { parseAmount } from "./money";
import { normaliseRef } from "./normalise";

/** Minimal CSV parser: quoted fields with "" escapes, \r\n or \n line ends. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return rows
    .filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""))
    .map((r) => Object.fromEntries(header.map((h, j) => [h, r[j] ?? ""])));
}

function parseDate(raw: string): string {
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`bad date: ${raw}`);
  return s;
}

export function loadStatementCsv(text: string): StatementLine[] {
  return parseCsv(text).map((row, i) => {
    const rawRef = (row["ref"] ?? "").trim();
    return {
      id: `S${i + 1}`,
      raw_ref: rawRef,
      normalised_ref: normaliseRef(rawRef),
      doc_date: parseDate(row["date"] ?? ""),
      doc_type: (row["type"] ?? "").trim().toUpperCase(),
      amount: parseAmount(row["amount"] ?? ""),
      currency: (row["currency"] ?? "").trim().toUpperCase() || "USD",
      po_number: (row["po"] ?? "").trim(),
    };
  });
}

export function loadLedgerCsv(text: string): LedgerLine[] {
  return parseCsv(text).map((row, i) => {
    const rawRef = (row["ref"] ?? "").trim();
    return {
      id: `L${i + 1}`,
      supplier: (row["supplier"] ?? "").trim(),
      raw_ref: rawRef,
      normalised_ref: normaliseRef(rawRef),
      doc_date: parseDate(row["date"] ?? ""),
      doc_type: (row["type"] ?? "").trim().toUpperCase(),
      original_amount: parseAmount(row["original"] ?? ""),
      open_amount: parseAmount(row["open"] ?? ""),
      currency: (row["currency"] ?? "").trim().toUpperCase() || "USD",
      po_number: (row["po"] ?? "").trim(),
    };
  });
}
