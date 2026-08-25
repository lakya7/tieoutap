/** Core data structures. Money is always integer minor units (cents) — never
 * fractional floats. Dates are ISO "YYYY-MM-DD" strings throughout so that
 * ordering is lexicographic and timezone-free. */

export type Cents = number; // signed integer minor units

// Finding types
export const DUPLICATE = "DUPLICATE";
export const UNCLAIMED_CREDIT = "UNCLAIMED_CREDIT";
export const TIMING = "TIMING";
export const UNRECORDED_LIABILITY = "UNRECORDED_LIABILITY";
export const PART_PAYMENT = "PART_PAYMENT";
export const AMOUNT_MISMATCH = "AMOUNT_MISMATCH";
export const PAYMENT_NOT_APPLIED = "PAYMENT_NOT_APPLIED";
export const SUPPLIER_OMISSION = "SUPPLIER_OMISSION";
export const CURRENCY_MISMATCH = "CURRENCY_MISMATCH";

// Buckets, in fixed report order
export const CASH_AT_RISK = "cash_at_risk";
export const UNRECORDED_LIABILITY_BUCKET = "unrecorded_liability";
export const INVESTIGATE = "investigate";
export const EXPLAINED = "explained";
export const BUCKET_ORDER = [
  CASH_AT_RISK, UNRECORDED_LIABILITY_BUCKET, INVESTIGATE, EXPLAINED,
] as const;

export interface LedgerLine {
  id: string;
  supplier: string;
  raw_ref: string;
  normalised_ref: string;
  doc_date: string; // ISO YYYY-MM-DD
  doc_type: string; // "INV" | "CRN" | "PAY"
  original_amount: Cents;
  open_amount: Cents;
  currency: string;
  po_number: string;
}

export interface StatementLine {
  id: string;
  raw_ref: string;
  normalised_ref: string;
  doc_date: string;
  doc_type: string;
  amount: Cents;
  currency: string;
  po_number: string;
}

export interface Match {
  statement_line_ids: string[];
  ledger_line_ids: string[];
  method: string; // "exact_ref" | "normalised_ref" | "amount_date" | "subset_sum"
  confidence: string; // fixed-point 2dp string, e.g. "1.00"
  amount_delta: Cents;
  requires_human_confirmation: boolean;
}

export type Evidence = Record<
  string,
  string | number | boolean | string[] | number[]
>;

export interface Finding {
  type: string;
  bucket: string;
  amount: Cents; // magnitude
  statement_line_ids: string[];
  ledger_line_ids: string[];
  rule_id: string;
  evidence: Evidence;
}

export interface ProposedRule {
  supplier: string;
  kind: string;
  value: string;
  statement_line_ids: string[];
  ledger_line_ids: string[];
}

export interface BridgeAdjustment {
  label: string;
  ref: string;
  finding_type: string;
  amount: Cents; // signed
}

export interface Bridge {
  ledger_open_total: Cents;
  statement_total: Cents;
  adjustments: BridgeAdjustment[];
  ties_out: boolean;
}

export interface ReconcileResult {
  supplier: string;
  as_at: string;
  matches: Match[];
  findings: Finding[];
  proposed_rules: ProposedRule[];
  bridge: Bridge;
  warnings: string[];
  diagnostic: string | null;
}

/** Whole days between two ISO dates: b - a. */
export function daysBetween(a: string, b: string): number {
  return (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000;
}

/** ISO date shifted by a signed number of days. */
export function addDays(iso: string, days: number): string {
  const d = new Date(Date.parse(iso + "T00:00:00Z") + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}
