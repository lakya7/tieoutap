"""The bridge: signed adjustments from ledger open total to statement total.

`ledger_total + sum(adjustments) == statement_total`, exactly, or the run is
marked not tying out and findings are suppressed by the engine.
"""
from __future__ import annotations

from .models import (
    AMOUNT_MISMATCH, DUPLICATE, PART_PAYMENT, PAYMENT_NOT_APPLIED,
    SUPPLIER_OMISSION, TIMING, UNCLAIMED_CREDIT, UNRECORDED_LIABILITY,
    Bridge, BridgeAdjustment, Cents, Finding, LedgerLine, StatementLine,
)

_LABELS = {
    DUPLICATE: "duplicate posting in ledger",
    UNCLAIMED_CREDIT: "credit on statement, absent from ledger",
    UNRECORDED_LIABILITY: "invoice not posted",
    PART_PAYMENT: "part payment applied by us, not by supplier",
    TIMING: "raised after cut-off",
    PAYMENT_NOT_APPLIED: "payment not applied by supplier",
    SUPPLIER_OMISSION: "in ledger, not on statement",
}


def _delta(finding: Finding) -> Cents:
    if "bridge_delta" in finding.evidence:
        return finding.evidence["bridge_delta"]
    if finding.type == DUPLICATE:
        return -finding.amount
    raise ValueError(f"finding {finding.type} has no bridge delta")


def _label(finding: Finding, delta: Cents) -> str:
    if finding.type == AMOUNT_MISMATCH:
        side = "above" if delta >= 0 else "below"
        return f"statement {side} ledger amount"
    return _LABELS.get(finding.type, finding.type.lower().replace("_", " "))


def _ref(
    finding: Finding,
    s_by_id: dict[str, StatementLine],
    l_by_id: dict[str, LedgerLine],
) -> str:
    refs: list[str] = []
    for r in [s_by_id[i].raw_ref for i in finding.statement_line_ids] + [
        l_by_id[i].raw_ref for i in finding.ledger_line_ids
    ]:
        if r not in refs:
            refs.append(r)
    return "+".join(refs)


def build_bridge(
    findings: list[Finding],
    ledger_open_total: Cents,
    statement_total: Cents,
    s_by_id: dict[str, StatementLine],
    l_by_id: dict[str, LedgerLine],
) -> Bridge:
    adjustments = tuple(
        BridgeAdjustment(
            label=_label(f, _delta(f)), ref=_ref(f, s_by_id, l_by_id),
            finding_type=f.type, amount=_delta(f),
        )
        for f in findings
    )
    ties_out = ledger_open_total + sum(a.amount for a in adjustments) == statement_total
    return Bridge(ledger_open_total, statement_total, adjustments, ties_out)
