"""Reconciliation cascade orchestrator.

Order is a correctness requirement:
  Pass 0 duplicates -> 1 exact ref -> 2 normalised ref -> 3 ref-match/amount-differ
  -> 4 amount+date -> 5 subset sums -> 6 classify residuals -> bridge.

Pass 0 must run before any matching: if matching ran first, one of a
duplicate pair would be consumed by a match and the duplicate would become
undetectable.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from .bridge import build_bridge
from .models import BUCKET_ORDER, Finding, LedgerLine, ReconcileResult, StatementLine
from .passes import (
    pass0_duplicates, pass1_exact_ref, pass2_normalised_ref,
    pass3_ref_amount_differ, pass4_amount_date, pass5_subset_sums, pass6_classify,
)


@dataclass(frozen=True)
class Config:
    duplicate_window_days: int = 30
    duplicate_tight_days: int = 7
    amount_date_window_days: int = 5
    timing_days: int = 3
    subset_max_size: int = 6


def _without(lines, ids):
    return [x for x in lines if x.id not in ids]


def _finding_sort_key(f: Finding):
    return (BUCKET_ORDER.index(f.bucket), -f.amount, f.type,
            f.statement_line_ids, f.ledger_line_ids)


def reconcile(
    statement: list[StatementLine],
    ledger: list[LedgerLine],
    supplier: str,
    as_at: date,
    config: Config = Config(),
    ledger_as_at: date | None = None,
) -> ReconcileResult:
    warnings: list[str] = []
    if ledger_as_at is not None and ledger_as_at != as_at:
        warnings.append(
            f"ledger as-at {ledger_as_at.isoformat()} does not equal statement "
            f"as-at {as_at.isoformat()}: the two balances describe different "
            f"dates and differences may be timing artefacts"
        )

    supplier_ledger = sorted(
        (l for l in ledger if l.supplier == supplier), key=lambda l: (l.doc_date, l.id)
    )
    statement = sorted(statement, key=lambda s: (s.doc_date, s.id))
    s_by_id = {s.id: s for s in statement}
    l_by_id = {l.id: l for l in supplier_ledger}

    ledger_open_total = sum(l.open_amount for l in supplier_ledger)
    statement_total = sum(s.amount for s in statement)

    # Pass 0 — duplicate scan, before any matching.
    dup_findings, excluded = pass0_duplicates(
        supplier_ledger, config.duplicate_window_days, config.duplicate_tight_days
    )
    rem_l = [l for l in supplier_ledger if l.id not in excluded]
    rem_s = list(statement)
    matches = []

    # Pass 1 — exact reference.
    m1, ms, ml = pass1_exact_ref(rem_s, rem_l)
    matches += m1
    rem_s, rem_l = _without(rem_s, ms), _without(rem_l, ml)

    # Pass 2 — normalised reference.
    m2, proposed_rules, ms, ml = pass2_normalised_ref(rem_s, rem_l, supplier)
    matches += m2
    rem_s, rem_l = _without(rem_s, ms), _without(rem_l, ml)

    # Pass 3 — ref matches, amounts differ: linked, not matched.
    links, cs, cl = pass3_ref_amount_differ(rem_s, rem_l)
    rem_s, rem_l = _without(rem_s, cs), _without(rem_l, cl)

    # Pass 4 — amount + date window.
    m4, ms, ml = pass4_amount_date(rem_s, rem_l, config.amount_date_window_days)
    matches += m4
    rem_s, rem_l = _without(rem_s, ms), _without(rem_l, ml)

    # Pass 5 — bounded subset sums, both directions.
    m5, ms, ml = pass5_subset_sums(rem_s, rem_l, config.subset_max_size)
    matches += m5
    rem_s, rem_l = _without(rem_s, ms), _without(rem_l, ml)

    # Pass 6 — classify residuals.
    findings = dup_findings + pass6_classify(
        rem_s, rem_l, links, matches, s_by_id, l_by_id, as_at, config.timing_days
    )
    findings = sorted(findings, key=_finding_sort_key)

    bridge = build_bridge(findings, ledger_open_total, statement_total, s_by_id, l_by_id)

    diagnostic = None
    if not bridge.ties_out:
        gap = statement_total - ledger_open_total - sum(a.amount for a in bridge.adjustments)
        diagnostic = (
            "bridge does not tie out: ledger open total plus adjustments misses "
            f"the statement total by {gap} minor units; findings suppressed"
        )
        findings = []

    return ReconcileResult(
        supplier=supplier, as_at=as_at, matches=tuple(matches),
        findings=tuple(findings), proposed_rules=tuple(proposed_rules),
        bridge=bridge, warnings=tuple(warnings), diagnostic=diagnostic,
    )
