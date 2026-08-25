/** Reconciliation cascade orchestrator.
 *
 * Order is a correctness requirement:
 *   Pass 0 duplicates -> 1 exact ref -> 2 normalised ref
 *   -> 3 ref-match/amount-differ -> 4 amount+date -> 5 subset sums
 *   -> 6 classify residuals -> bridge.
 *
 * Pass 0 must run before any matching: if matching ran first, one of a
 * duplicate pair would be consumed by a match and the duplicate would become
 * undetectable. */
import { buildBridge } from "./bridge";
import { BUCKET_ORDER } from "./models";
import type {
  Finding, LedgerLine, Match, ReconcileResult, StatementLine,
} from "./models";
import {
  pass0Duplicates, pass1ExactRef, pass2NormalisedRef, pass3RefAmountDiffer,
  pass4AmountDate, pass5SubsetSums, pass6Classify,
} from "./passes";

export interface Config {
  duplicateWindowDays: number;
  duplicateTightDays: number;
  amountDateWindowDays: number;
  timingDays: number;
  subsetMaxSize: number;
}

export const DEFAULT_CONFIG: Config = {
  duplicateWindowDays: 30,
  duplicateTightDays: 7,
  amountDateWindowDays: 5,
  timingDays: 3,
  subsetMaxSize: 6,
};

function cmp(a: string | number, b: string | number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function cmpIds(a: string[], b: string[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const c = cmp(a[i]!, b[i]!);
    if (c !== 0) return c;
  }
  return a.length - b.length;
}

function findingOrder(a: Finding, b: Finding): number {
  return (
    BUCKET_ORDER.indexOf(a.bucket as (typeof BUCKET_ORDER)[number]) -
      BUCKET_ORDER.indexOf(b.bucket as (typeof BUCKET_ORDER)[number]) ||
    b.amount - a.amount ||
    cmp(a.type, b.type) ||
    cmpIds(a.statement_line_ids, b.statement_line_ids) ||
    cmpIds(a.ledger_line_ids, b.ledger_line_ids)
  );
}

function without<T extends { id: string }>(lines: T[], ids: Set<string>): T[] {
  return lines.filter((x) => !ids.has(x.id));
}

function byDateId(
  a: { doc_date: string; id: string },
  b: { doc_date: string; id: string },
): number {
  return cmp(a.doc_date, b.doc_date) || cmp(a.id, b.id);
}

export function reconcile(
  statementIn: StatementLine[],
  ledger: LedgerLine[],
  supplier: string,
  asAt: string,
  config: Config = DEFAULT_CONFIG,
  ledgerAsAt: string | null = null,
): ReconcileResult {
  const warnings: string[] = [];
  if (ledgerAsAt !== null && ledgerAsAt !== asAt) {
    warnings.push(
      `ledger as-at ${ledgerAsAt} does not equal statement as-at ${asAt}: ` +
        "the two balances describe different dates and differences may be " +
        "timing artefacts",
    );
  }

  const supplierLedger = ledger
    .filter((l) => l.supplier === supplier)
    .sort(byDateId);
  const statement = [...statementIn].sort(byDateId);
  const sById = new Map(statement.map((s) => [s.id, s]));
  const lById = new Map(supplierLedger.map((l) => [l.id, l]));

  let ledgerOpenTotal = 0;
  for (const l of supplierLedger) ledgerOpenTotal += l.open_amount;
  let statementTotal = 0;
  for (const s of statement) statementTotal += s.amount;

  // Pass 0 — duplicate scan, before any matching.
  const [dupFindings, excluded] = pass0Duplicates(
    supplierLedger, config.duplicateWindowDays, config.duplicateTightDays,
  );
  let remL = supplierLedger.filter((l) => !excluded.has(l.id));
  let remS = [...statement];
  const matches: Match[] = [];

  // Pass 1 — exact reference.
  const [m1, ms1, ml1] = pass1ExactRef(remS, remL);
  matches.push(...m1);
  remS = without(remS, ms1);
  remL = without(remL, ml1);

  // Pass 2 — normalised reference.
  const [m2, proposedRules, ms2, ml2] = pass2NormalisedRef(remS, remL, supplier);
  matches.push(...m2);
  remS = without(remS, ms2);
  remL = without(remL, ml2);

  // Pass 3 — ref matches, amounts differ: linked, not matched.
  const [links, cs, cl] = pass3RefAmountDiffer(remS, remL);
  remS = without(remS, cs);
  remL = without(remL, cl);

  // Pass 4 — amount + date window.
  const [m4, ms4, ml4] = pass4AmountDate(remS, remL, config.amountDateWindowDays);
  matches.push(...m4);
  remS = without(remS, ms4);
  remL = without(remL, ml4);

  // Pass 5 — bounded subset sums, both directions.
  const [m5, ms5, ml5] = pass5SubsetSums(remS, remL, config.subsetMaxSize);
  matches.push(...m5);
  remS = without(remS, ms5);
  remL = without(remL, ml5);

  // Pass 6 — classify residuals.
  let findings = [
    ...dupFindings,
    ...pass6Classify(remS, remL, links, matches, sById, lById, asAt, config.timingDays),
  ].sort(findingOrder);

  const bridge = buildBridge(findings, ledgerOpenTotal, statementTotal, sById, lById);

  let diagnostic: string | null = null;
  if (!bridge.ties_out) {
    let adjustmentTotal = 0;
    for (const a of bridge.adjustments) adjustmentTotal += a.amount;
    const gap = statementTotal - ledgerOpenTotal - adjustmentTotal;
    diagnostic =
      "bridge does not tie out: ledger open total plus adjustments misses " +
      `the statement total by ${gap} minor units; findings suppressed`;
    findings = [];
  }

  return {
    supplier,
    as_at: asAt,
    matches,
    findings,
    proposed_rules: proposedRules,
    bridge,
    warnings,
    diagnostic,
  };
}
