/** The bridge: signed adjustments from ledger open total to statement total.
 * `ledger_total + sum(adjustments) === statement_total`, exactly, or the run
 * is marked not tying out and findings are suppressed by the engine. */
import {
  AMOUNT_MISMATCH, DUPLICATE, PART_PAYMENT, PAYMENT_NOT_APPLIED,
  SUPPLIER_OMISSION, TIMING, UNCLAIMED_CREDIT, UNRECORDED_LIABILITY,
} from "./models";
import type {
  Bridge, BridgeAdjustment, Cents, Finding, LedgerLine, StatementLine,
} from "./models";

const LABELS: Record<string, string> = {
  [DUPLICATE]: "duplicate posting in ledger",
  [UNCLAIMED_CREDIT]: "credit on statement, absent from ledger",
  [UNRECORDED_LIABILITY]: "invoice not posted",
  [PART_PAYMENT]: "part payment applied by us, not by supplier",
  [TIMING]: "raised after cut-off",
  [PAYMENT_NOT_APPLIED]: "payment not applied by supplier",
  [SUPPLIER_OMISSION]: "in ledger, not on statement",
};

function delta(finding: Finding): Cents {
  if ("bridge_delta" in finding.evidence) {
    return finding.evidence["bridge_delta"] as Cents;
  }
  if (finding.type === DUPLICATE) return -finding.amount;
  throw new Error(`finding ${finding.type} has no bridge delta`);
}

function label(finding: Finding, d: Cents): string {
  if (finding.type === AMOUNT_MISMATCH) {
    const side = d >= 0 ? "above" : "below";
    return `statement ${side} ledger amount`;
  }
  return LABELS[finding.type] ?? finding.type.toLowerCase().replace(/_/g, " ");
}

function ref(
  finding: Finding,
  sById: Map<string, StatementLine>,
  lById: Map<string, LedgerLine>,
): string {
  const refs: string[] = [];
  const all = [
    ...finding.statement_line_ids.map((i) => sById.get(i)!.raw_ref),
    ...finding.ledger_line_ids.map((i) => lById.get(i)!.raw_ref),
  ];
  for (const r of all) if (!refs.includes(r)) refs.push(r);
  return refs.join("+");
}

export function buildBridge(
  findings: Finding[],
  ledgerOpenTotal: Cents,
  statementTotal: Cents,
  sById: Map<string, StatementLine>,
  lById: Map<string, LedgerLine>,
): Bridge {
  const adjustments: BridgeAdjustment[] = findings.map((f) => ({
    label: label(f, delta(f)),
    ref: ref(f, sById, lById),
    finding_type: f.type,
    amount: delta(f),
  }));
  let total = ledgerOpenTotal;
  for (const a of adjustments) total += a.amount;
  return {
    ledger_open_total: ledgerOpenTotal,
    statement_total: statementTotal,
    adjustments,
    ties_out: total === statementTotal,
  };
}
