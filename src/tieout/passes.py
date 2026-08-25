"""Cascade passes. Each pass is a pure function; the engine wires them in order."""
from __future__ import annotations

from datetime import date

from .models import CASH_AT_RISK, DUPLICATE, Cents, Finding, LedgerLine


def _fmt_confidence(basis_points: int) -> str:
    """Fixed-point 2dp confidence from integer basis points (9500 -> '0.95')."""
    bp = min(basis_points, 9500)
    return f"{bp // 10000}.{(bp % 10000) // 100:02d}"


def _ref_core(normalised_ref: str) -> str:
    """Normalised ref with trailing letters stripped: '88690A' -> '88690'."""
    return normalised_ref.rstrip("ABCDEFGHIJKLMNOPQRSTUVWXYZ")


def _near_identical_refs(a: LedgerLine, b: LedgerLine) -> bool:
    core_a, core_b = _ref_core(a.normalised_ref), _ref_core(b.normalised_ref)
    return bool(core_a) and core_a == core_b


def pass0_duplicates(
    ledger: list[LedgerLine],
    duplicate_window_days: int = 30,
    duplicate_tight_days: int = 7,
) -> tuple[list[Finding], set[str]]:
    """Duplicate scan over ledger lines only, before any matching.

    Groups by open_amount; within a group, lines whose doc_date falls within
    the window of the earliest line form a duplicate cluster. The earliest
    line (ties broken by raw_ref, then id) is kept as the original; each later
    line is flagged as the extra, emitted as a DUPLICATE finding, and excluded
    from all subsequent passes.

    Confidence starts at 0.70 and is raised by corroborating signals:
    near-identical references (+0.10), matching PO numbers (+0.10),
    doc dates within the tight window (+0.10), capped at 0.95.
    """
    findings: list[Finding] = []
    excluded: set[str] = set()

    by_amount: dict[Cents, list[LedgerLine]] = {}
    for line in ledger:
        if line.open_amount == 0:
            continue
        by_amount.setdefault(line.open_amount, []).append(line)

    for amount in sorted(by_amount):
        group = sorted(by_amount[amount], key=lambda l: (l.doc_date, l.raw_ref, l.id))
        if len(group) < 2:
            continue
        original = group[0]
        for extra in group[1:]:
            gap_days = (extra.doc_date - original.doc_date).days
            if gap_days > duplicate_window_days:
                continue
            confidence_bp = 7000
            signals = []
            if _near_identical_refs(original, extra):
                confidence_bp += 1000
                signals.append("near_identical_refs")
            if original.po_number and original.po_number == extra.po_number:
                confidence_bp += 1000
                signals.append("po_match")
            if gap_days <= duplicate_tight_days:
                confidence_bp += 1000
                signals.append("dates_within_tight_window")
            findings.append(
                Finding(
                    type=DUPLICATE,
                    bucket=CASH_AT_RISK,
                    amount=extra.open_amount,
                    statement_line_ids=(),
                    ledger_line_ids=(extra.id,),
                    rule_id="pass0.duplicate_scan",
                    evidence={
                        "original_ledger_line_id": original.id,
                        "original_ref": original.raw_ref,
                        "duplicate_ref": extra.raw_ref,
                        "days_apart": gap_days,
                        "confidence": _fmt_confidence(confidence_bp),
                        "signals": signals,
                    },
                )
            )
            excluded.add(extra.id)

    return findings, excluded
