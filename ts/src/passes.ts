/** Cascade passes. Each pass is a pure function; the engine wires them in
 * order. This is a line-for-line port of the Python reference engine: every
 * ordering rule and tie-break is identical so that serialised output is
 * byte-identical. */
import {
  AMOUNT_MISMATCH, CASH_AT_RISK, CURRENCY_MISMATCH, DUPLICATE, EXPLAINED,
  INVESTIGATE, PART_PAYMENT, PAYMENT_NOT_APPLIED, SUPPLIER_OMISSION, TIMING,
  UNCLAIMED_CREDIT, UNRECORDED_LIABILITY, UNRECORDED_LIABILITY_BUCKET,
} from "./models";
import type {
  Cents, Evidence, Finding, LedgerLine, Match, ProposedRule, StatementLine,
} from "./models";
import { daysBetween, addDays } from "./models";
import { alphaPrefix } from "./normalise";

function cmp(a: string | number, b: string | number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function byDateId(
  a: { doc_date: string; id: string },
  b: { doc_date: string; id: string },
): number {
  return cmp(a.doc_date, b.doc_date) || cmp(a.id, b.id);
}

function makeMatch(
  sIds: string[], lIds: string[], method: string, confidence: string,
  confirm = false,
): Match {
  return {
    statement_line_ids: sIds,
    ledger_line_ids: lIds,
    method,
    confidence,
    amount_delta: 0,
    requires_human_confirmation: confirm,
  };
}

/** Fixed-point 2dp confidence from integer basis points (9500 -> "0.95"). */
function fmtConfidence(basisPoints: number): string {
  const bp = Math.min(basisPoints, 9500);
  const frac = String(Math.trunc((bp % 10000) / 100)).padStart(2, "0");
  return `${Math.trunc(bp / 10000)}.${frac}`;
}

/** Normalised ref with trailing letters stripped: "88690A" -> "88690". */
function refCore(normalisedRef: string): string {
  return normalisedRef.replace(/[A-Z]+$/, "");
}

function nearIdenticalRefs(a: LedgerLine, b: LedgerLine): boolean {
  const coreA = refCore(a.normalised_ref);
  const coreB = refCore(b.normalised_ref);
  return coreA !== "" && coreA === coreB;
}

/** Pass 0 — duplicate scan over ledger lines only, before any matching.
 *
 * Groups by open_amount; the earliest line in a window is kept as the
 * original, later lines are flagged as DUPLICATE and excluded from all
 * subsequent passes. Confidence 0.70 plus 0.10 per corroborating signal,
 * capped at 0.95. */
export function pass0Duplicates(
  ledger: LedgerLine[],
  duplicateWindowDays = 30,
  duplicateTightDays = 7,
): [Finding[], Set<string>] {
  const findings: Finding[] = [];
  const excluded = new Set<string>();

  const byAmount = new Map<Cents, LedgerLine[]>();
  for (const line of ledger) {
    if (line.open_amount === 0) continue;
    const group = byAmount.get(line.open_amount);
    if (group) group.push(line);
    else byAmount.set(line.open_amount, [line]);
  }

  for (const amount of [...byAmount.keys()].sort((a, b) => a - b)) {
    const group = [...byAmount.get(amount)!].sort(
      (a, b) => cmp(a.doc_date, b.doc_date) || cmp(a.raw_ref, b.raw_ref) || cmp(a.id, b.id),
    );
    if (group.length < 2) continue;
    const original = group[0]!;
    for (const extra of group.slice(1)) {
      const gapDays = daysBetween(original.doc_date, extra.doc_date);
      if (gapDays > duplicateWindowDays) continue;
      let confidenceBp = 7000;
      const signals: string[] = [];
      if (nearIdenticalRefs(original, extra)) {
        confidenceBp += 1000;
        signals.push("near_identical_refs");
      }
      if (original.po_number && original.po_number === extra.po_number) {
        confidenceBp += 1000;
        signals.push("po_match");
      }
      if (gapDays <= duplicateTightDays) {
        confidenceBp += 1000;
        signals.push("dates_within_tight_window");
      }
      findings.push({
        type: DUPLICATE,
        bucket: CASH_AT_RISK,
        amount: extra.open_amount,
        statement_line_ids: [],
        ledger_line_ids: [extra.id],
        rule_id: "pass0.duplicate_scan",
        evidence: {
          original_ledger_line_id: original.id,
          original_ref: original.raw_ref,
          duplicate_ref: extra.raw_ref,
          days_apart: gapDays,
          confidence: fmtConfidence(confidenceBp),
          signals,
        },
      });
      excluded.add(extra.id);
    }
  }

  return [findings, excluded];
}

/** Pass 1 — exact reference match: raw_ref equal AND amounts equal.
 * Confidence 1.00; greedy (doc_date, id) pairing for determinism. */
export function pass1ExactRef(
  statement: StatementLine[],
  ledger: LedgerLine[],
): [Match[], Set<string>, Set<string>] {
  const matches: Match[] = [];
  const matchedS = new Set<string>();
  const matchedL = new Set<string>();

  const ledgerByRef = new Map<string, LedgerLine[]>();
  for (const line of ledger) {
    const list = ledgerByRef.get(line.raw_ref);
    if (list) list.push(line);
    else ledgerByRef.set(line.raw_ref, [line]);
  }
  for (const candidates of ledgerByRef.values()) candidates.sort(byDateId);

  for (const sLine of [...statement].sort(byDateId)) {
    for (const lLine of ledgerByRef.get(sLine.raw_ref) ?? []) {
      if (matchedL.has(lLine.id)) continue;
      if (sLine.amount !== lLine.open_amount) continue;
      matches.push(makeMatch([sLine.id], [lLine.id], "exact_ref", "1.00"));
      matchedS.add(sLine.id);
      matchedL.add(lLine.id);
      break;
    }
  }

  return [matches, matchedS, matchedL];
}

/** Pass 2 — normalised reference match: normalised_ref equal AND amounts
 * equal. Confidence 0.95; proposes a strip_prefix rule when raw refs differ,
 * deduplicated by prefix value. */
export function pass2NormalisedRef(
  statement: StatementLine[],
  ledger: LedgerLine[],
  supplier: string,
): [Match[], ProposedRule[], Set<string>, Set<string>] {
  const matches: Match[] = [];
  const rules = new Map<string, ProposedRule>();
  const matchedS = new Set<string>();
  const matchedL = new Set<string>();

  const ledgerByNorm = new Map<string, LedgerLine[]>();
  for (const line of ledger) {
    if (!line.normalised_ref) continue;
    const list = ledgerByNorm.get(line.normalised_ref);
    if (list) list.push(line);
    else ledgerByNorm.set(line.normalised_ref, [line]);
  }
  for (const candidates of ledgerByNorm.values()) candidates.sort(byDateId);

  for (const sLine of [...statement].sort(byDateId)) {
    if (!sLine.normalised_ref) continue;
    for (const lLine of ledgerByNorm.get(sLine.normalised_ref) ?? []) {
      if (matchedL.has(lLine.id)) continue;
      if (sLine.amount !== lLine.open_amount) continue;
      matches.push(makeMatch([sLine.id], [lLine.id], "normalised_ref", "0.95"));
      matchedS.add(sLine.id);
      matchedL.add(lLine.id);
      if (sLine.raw_ref !== lLine.raw_ref) {
        const prefix = alphaPrefix(lLine.raw_ref) || alphaPrefix(sLine.raw_ref);
        if (prefix) {
          const key = `strip_prefix\u0000${prefix}`;
          const old = rules.get(key);
          rules.set(key, {
            supplier,
            kind: "strip_prefix",
            value: prefix,
            statement_line_ids: [
              ...(old ? old.statement_line_ids : []), sLine.id,
            ].sort(),
            ledger_line_ids: [
              ...(old ? old.ledger_line_ids : []), lLine.id,
            ].sort(),
          });
        }
      }
      break;
    }
  }

  const proposed = [...rules.keys()].sort().map((k) => rules.get(k)!);
  return [matches, proposed, matchedS, matchedL];
}

/** A statement/ledger pair whose references match but amounts differ.
 * Not a Match: routed to Pass 6, which classifies it as PART_PAYMENT,
 * AMOUNT_MISMATCH or CURRENCY_MISMATCH using the preserved link. */
export interface RefLink {
  statement_line_id: string;
  ledger_line_id: string;
  via: string; // "exact_ref" | "normalised_ref"
}

/** Pass 3 — reference matches (raw, else normalised) but amounts differ.
 * Pairs are consumed (excluded from Passes 4-5) but produce no Match. */
export function pass3RefAmountDiffer(
  statement: StatementLine[],
  ledger: LedgerLine[],
): [RefLink[], Set<string>, Set<string>] {
  const links: RefLink[] = [];
  const consumedS = new Set<string>();
  const consumedL = new Set<string>();

  const byRaw = new Map<string, LedgerLine[]>();
  const byNorm = new Map<string, LedgerLine[]>();
  for (const line of ledger) {
    const rawList = byRaw.get(line.raw_ref);
    if (rawList) rawList.push(line);
    else byRaw.set(line.raw_ref, [line]);
    if (line.normalised_ref) {
      const normList = byNorm.get(line.normalised_ref);
      if (normList) normList.push(line);
      else byNorm.set(line.normalised_ref, [line]);
    }
  }
  for (const index of [byRaw, byNorm]) {
    for (const candidates of index.values()) candidates.sort(byDateId);
  }

  for (const sLine of [...statement].sort(byDateId)) {
    let candidates: [LedgerLine, string][] = (byRaw.get(sLine.raw_ref) ?? []).map(
      (l) => [l, "exact_ref"],
    );
    if (candidates.length === 0 && sLine.normalised_ref) {
      candidates = (byNorm.get(sLine.normalised_ref) ?? []).map((l) => [
        l, "normalised_ref",
      ]);
    }
    for (const [lLine, via] of candidates) {
      if (consumedL.has(lLine.id)) continue;
      links.push({ statement_line_id: sLine.id, ledger_line_id: lLine.id, via });
      consumedS.add(sLine.id);
      consumedL.add(lLine.id);
      break;
    }
  }

  return [links, consumedS, consumedL];
}

/** Pass 4 — amount + date window match for lines with no usable reference.
 * Confidence capped at 0.70, always requires human confirmation. */
export function pass4AmountDate(
  statement: StatementLine[],
  ledger: LedgerLine[],
  windowDays = 5,
): [Match[], Set<string>, Set<string>] {
  const matches: Match[] = [];
  const matchedS = new Set<string>();
  const matchedL = new Set<string>();

  const ledgerByAmount = new Map<Cents, LedgerLine[]>();
  for (const line of ledger) {
    if (line.normalised_ref) continue;
    const list = ledgerByAmount.get(line.open_amount);
    if (list) list.push(line);
    else ledgerByAmount.set(line.open_amount, [line]);
  }

  for (const sLine of [...statement].sort(byDateId)) {
    if (sLine.normalised_ref) continue;
    const candidates = (ledgerByAmount.get(sLine.amount) ?? []).filter(
      (l) =>
        !matchedL.has(l.id) &&
        Math.abs(daysBetween(sLine.doc_date, l.doc_date)) <= windowDays,
    );
    if (candidates.length === 0) continue;
    const best = candidates.reduce((a, b) => {
      const gap = (l: LedgerLine) => Math.abs(daysBetween(sLine.doc_date, l.doc_date));
      const order = cmp(gap(a), gap(b)) || byDateId(a, b);
      return order <= 0 ? a : b;
    });
    matches.push(makeMatch([sLine.id], [best.id], "amount_date", "0.70", true));
    matchedS.add(sLine.id);
    matchedL.add(best.id);
  }

  return [matches, matchedS, matchedL];
}

/** All k-combinations of items in lexicographic index order (itertools order). */
function* combinations<T>(items: T[], k: number): Generator<T[]> {
  const n = items.length;
  if (k > n) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield idx.map((i) => items[i]!);
    let i = k - 1;
    while (i >= 0 && idx[i]! === i + n - k) i--;
    if (i < 0) return;
    idx[i]!++;
    idx[i] = idx[i]!;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1]! + 1;
  }
}

/** Smallest, lexicographically-first subset (size 2..maxSize) summing to
 * target. Lines must already be in deterministic order. */
function firstSubsetSummingTo<T>(
  lines: T[], target: Cents, maxSize: number, amountOf: (line: T) => Cents,
): T[] | null {
  for (let size = 2; size <= Math.min(maxSize, lines.length); size++) {
    for (const combo of combinations(lines, size)) {
      let sum = 0;
      for (const l of combo) sum += amountOf(l);
      if (sum === target) return combo;
    }
  }
  return null;
}

/** Pass 5 — bounded subset-sum over remaining residuals, both directions.
 * Confidence capped at 0.65, always flagged for human confirmation. */
export function pass5SubsetSums(
  statement: StatementLine[],
  ledger: LedgerLine[],
  maxSize = 6,
): [Match[], Set<string>, Set<string>] {
  const matches: Match[] = [];
  const matchedS = new Set<string>();
  const matchedL = new Set<string>();

  const sSorted = [...statement].sort(byDateId);
  const lSorted = [...ledger].sort(byDateId);

  // Direction A: N ledger -> 1 statement
  for (const sLine of sSorted) {
    const pool = lSorted.filter((l) => !matchedL.has(l.id));
    const combo = firstSubsetSummingTo(
      pool, sLine.amount, maxSize, (l) => l.open_amount,
    );
    if (combo === null) continue;
    matches.push(
      makeMatch(
        [sLine.id], combo.map((l) => l.id).sort(), "subset_sum", "0.65", true,
      ),
    );
    matchedS.add(sLine.id);
    for (const l of combo) matchedL.add(l.id);
  }

  // Direction B: N statement -> 1 ledger
  for (const lLine of lSorted) {
    if (matchedL.has(lLine.id)) continue;
    const pool = sSorted.filter((s) => !matchedS.has(s.id));
    const combo = firstSubsetSummingTo(
      pool, lLine.open_amount, maxSize, (s) => s.amount,
    );
    if (combo === null) continue;
    matches.push(
      makeMatch(
        combo.map((s) => s.id).sort(), [lLine.id], "subset_sum", "0.65", true,
      ),
    );
    matchedL.add(lLine.id);
    for (const s of combo) matchedS.add(s.id);
  }

  return [matches, matchedS, matchedL];
}

const PAYMENT_DOC_TYPES = ["PAY", "PAYMENT", "PMT"];

/** Pass 6 — classify everything that survived Passes 0-5, per the residual
 * table. Deterministic order: linked pairs, then statement residuals, then
 * ledger residuals. Never attempts FX conversion. */
export function pass6Classify(
  residualStatement: StatementLine[],
  residualLedger: LedgerLine[],
  links: RefLink[],
  matches: Match[],
  sById: Map<string, StatementLine>,
  lById: Map<string, LedgerLine>,
  asAt: string,
  timingDays = 3,
): Finding[] {
  const findings: Finding[] = [];
  const timingCutoff = addDays(asAt, -timingDays);

  const emit = (
    type: string, bucket: string, amount: Cents,
    sIds: string[], lIds: string[], rule: string, evidence: Evidence,
  ) => {
    findings.push({
      type, bucket, amount,
      statement_line_ids: sIds, ledger_line_ids: lIds,
      rule_id: rule, evidence,
    });
  };

  // Currency mismatch across matched pairs (equal-amount matches).
  for (const m of matches) {
    const currencies = [
      ...new Set([
        ...m.statement_line_ids.map((i) => sById.get(i)!.currency),
        ...m.ledger_line_ids.map((i) => lById.get(i)!.currency),
      ]),
    ].sort();
    if (currencies.length > 1) {
      let amount = 0;
      for (const i of m.statement_line_ids) amount += Math.abs(sById.get(i)!.amount);
      emit(
        CURRENCY_MISMATCH, INVESTIGATE, amount,
        m.statement_line_ids, m.ledger_line_ids, "pass6.currency_mismatch",
        { currencies, bridge_delta: 0 },
      );
    }
  }

  // Linked pairs from Pass 3: ref matches, amounts differ.
  const sortedLinks = [...links].sort(
    (a, b) =>
      cmp(sById.get(a.statement_line_id)!.doc_date, sById.get(b.statement_line_id)!.doc_date) ||
      cmp(a.statement_line_id, b.statement_line_id),
  );
  for (const link of sortedLinks) {
    const sLine = sById.get(link.statement_line_id)!;
    const lLine = lById.get(link.ledger_line_id)!;
    if (sLine.currency !== lLine.currency) {
      emit(
        CURRENCY_MISMATCH, INVESTIGATE, Math.abs(sLine.amount),
        [sLine.id], [lLine.id], "pass6.currency_mismatch",
        {
          currencies: [...new Set([sLine.currency, lLine.currency])].sort(),
          bridge_delta: sLine.amount - lLine.open_amount,
        },
      );
    } else if (
      sLine.amount === lLine.original_amount &&
      lLine.original_amount !== lLine.open_amount
    ) {
      emit(
        PART_PAYMENT, EXPLAINED,
        Math.abs(lLine.original_amount - lLine.open_amount),
        [sLine.id], [lLine.id], "pass6.part_payment",
        {
          statement_amount: sLine.amount,
          ledger_original_amount: lLine.original_amount,
          ledger_open_amount: lLine.open_amount,
          bridge_delta: lLine.original_amount - lLine.open_amount,
        },
      );
    } else {
      emit(
        AMOUNT_MISMATCH, INVESTIGATE,
        Math.abs(sLine.amount - lLine.open_amount),
        [sLine.id], [lLine.id], "pass6.amount_mismatch",
        {
          statement_amount: sLine.amount,
          ledger_open_amount: lLine.open_amount,
          bridge_delta: sLine.amount - lLine.open_amount,
        },
      );
    }
  }

  // On statement, not in ledger.
  for (const sLine of [...residualStatement].sort(byDateId)) {
    if (sLine.amount < 0) {
      emit(
        UNCLAIMED_CREDIT, CASH_AT_RISK, Math.abs(sLine.amount),
        [sLine.id], [], "pass6.unclaimed_credit",
        { bridge_delta: sLine.amount },
      );
    } else if (sLine.doc_date > timingCutoff) {
      emit(
        TIMING, EXPLAINED, Math.abs(sLine.amount), [sLine.id], [], "pass6.timing",
        {
          doc_date: sLine.doc_date,
          timing_cutoff: timingCutoff,
          bridge_delta: sLine.amount,
        },
      );
    } else {
      emit(
        UNRECORDED_LIABILITY, UNRECORDED_LIABILITY_BUCKET,
        Math.abs(sLine.amount), [sLine.id], [],
        "pass6.unrecorded_liability", { bridge_delta: sLine.amount },
      );
    }
  }

  // In ledger, not on statement.
  for (const lLine of [...residualLedger].sort(byDateId)) {
    if (PAYMENT_DOC_TYPES.includes(lLine.doc_type)) {
      emit(
        PAYMENT_NOT_APPLIED, EXPLAINED, Math.abs(lLine.open_amount),
        [], [lLine.id], "pass6.payment_not_applied",
        { bridge_delta: -lLine.open_amount },
      );
    } else {
      emit(
        SUPPLIER_OMISSION, INVESTIGATE, Math.abs(lLine.open_amount),
        [], [lLine.id], "pass6.supplier_omission",
        { bridge_delta: -lLine.open_amount },
      );
    }
  }

  return findings;
}
