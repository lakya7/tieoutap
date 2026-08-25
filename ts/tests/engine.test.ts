/** Behavioural regression tests ported from the Python suite. */
import { describe, expect, it, vi } from "vitest";

import { reconcile } from "../src/engine";
import type { LedgerLine, StatementLine } from "../src/models";
import { DUPLICATE } from "../src/models";
import { parseAmount, formatCents } from "../src/money";
import { normaliseRef } from "../src/normalise";
import { pass0Duplicates, pass1ExactRef, pass5SubsetSums } from "../src/passes";

const SUPPLIER = "MERIDIAN IND SUPPLIES";
const AS_AT = "2026-07-31";

function stmt(
  id: string, ref: string, date: string, amount: number,
): StatementLine {
  return {
    id, raw_ref: ref, normalised_ref: normaliseRef(ref), doc_date: date,
    doc_type: "INV", amount, currency: "USD", po_number: "",
  };
}

function ledg(
  id: string, ref: string, date: string, open: number,
  original = open, po = "",
): LedgerLine {
  return {
    id, supplier: SUPPLIER, raw_ref: ref, normalised_ref: normaliseRef(ref),
    doc_date: date, doc_type: "INV", original_amount: original,
    open_amount: open, currency: "USD", po_number: po,
  };
}

describe("money", () => {
  it("parses to integer cents, never floats", () => {
    expect(parseAmount("59,165.00")).toBe(5_916_500);
    expect(parseAmount("-2760.00")).toBe(-276_000);
    expect(parseAmount("0.1")).toBe(10);
    expect(parseAmount("7")).toBe(700);
    expect(Number.isInteger(parseAmount("123.45"))).toBe(true);
    expect(formatCents(-276_000)).toBe("-2760.00");
    expect(() => parseAmount("1.234")).toThrow();
    expect(() => parseAmount("abc")).toThrow();
  });
});

describe("pass ordering", () => {
  it("matching before Pass 0 would miss the duplicate", () => {
    const statement = [stmt("S1", "88690", "2026-07-02", 790_500)];
    const ledger = [
      ledg("L1", "88690", "2026-07-04", 790_500, 790_500, "45102"),
      ledg("L2", "88690A", "2026-07-07", 790_500, 790_500, "45102"),
    ];

    const [, , matchedL] = pass1ExactRef(statement, ledger);
    const leftovers = ledger.filter((l) => !matchedL.has(l.id));
    const [wrongOrderFindings] = pass0Duplicates(leftovers);
    expect(wrongOrderFindings).toEqual([]);

    const result = reconcile(statement, ledger, SUPPLIER, AS_AT);
    const dups = result.findings.filter((f) => f.type === DUPLICATE);
    expect(dups).toHaveLength(1);
  });
});

describe("pass 5 subset sums", () => {
  it("matches N ledger lines to one statement line", () => {
    const statement = [stmt("S1", "", "2026-07-10", 1_200_000)];
    const ledger = [
      ledg("L1", "", "2026-07-08", 500_000),
      ledg("L2", "", "2026-07-09", 700_000),
      ledg("L3", "", "2026-07-15", 990_000),
    ];
    const [matches] = pass5SubsetSums(statement, ledger);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.ledger_line_ids).toEqual(["L1", "L2"]);
    expect(matches[0]!.confidence).toBe("0.65");
    expect(matches[0]!.requires_human_confirmation).toBe(true);
  });
});

describe("bridge failure", () => {
  it("suppresses findings and sets a diagnostic when the bridge cannot tie", async () => {
    vi.resetModules();
    vi.doMock("../src/bridge", () => ({
      buildBridge: (
        _findings: unknown, ledgerOpenTotal: number, statementTotal: number,
      ) => ({
        ledger_open_total: ledgerOpenTotal,
        statement_total: statementTotal,
        adjustments: [],
        ties_out: false,
      }),
    }));
    const { reconcile: patched } = await import("../src/engine");
    const statement = [stmt("S1", "88802", "2026-07-15", 1_578_000)];
    const result = patched(statement, [], SUPPLIER, AS_AT);
    vi.doUnmock("../src/bridge");
    expect(result.bridge.ties_out).toBe(false);
    expect(result.findings).toEqual([]);
    expect(result.diagnostic).toContain("does not tie out");
  });
});
