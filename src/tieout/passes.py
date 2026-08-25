"""Cascade passes. Each pass is a pure function; the engine wires them in order."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from itertools import combinations

from .models import (
    CASH_AT_RISK,
    DUPLICATE,
    Cents,
    Finding,
    LedgerLine,
    Match,
    ProposedRule,
    StatementLine,
)
from .normalise import alpha_prefix


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


def pass1_exact_ref(
    statement: list[StatementLine],
    ledger: list[LedgerLine],
) -> tuple[list[Match], set[str], set[str]]:
    """Exact reference match: raw_ref equal on both sides AND amounts equal.

    Statement amount is compared to ledger open_amount. Confidence 1.00.
    Where a raw_ref appears more than once on a side, candidates are paired
    greedily in (doc_date, id) order for determinism.

    Returns (matches, matched_statement_ids, matched_ledger_ids).
    """
    matches: list[Match] = []
    matched_s: set[str] = set()
    matched_l: set[str] = set()

    ledger_by_ref: dict[str, list[LedgerLine]] = {}
    for line in ledger:
        ledger_by_ref.setdefault(line.raw_ref, []).append(line)
    for candidates in ledger_by_ref.values():
        candidates.sort(key=lambda l: (l.doc_date, l.id))

    for s_line in sorted(statement, key=lambda s: (s.doc_date, s.id)):
        for l_line in ledger_by_ref.get(s_line.raw_ref, []):
            if l_line.id in matched_l:
                continue
            if s_line.amount != l_line.open_amount:
                continue
            matches.append(
                Match(
                    statement_line_ids=(s_line.id,),
                    ledger_line_ids=(l_line.id,),
                    method="exact_ref",
                    confidence="1.00",
                    amount_delta=0,
                )
            )
            matched_s.add(s_line.id)
            matched_l.add(l_line.id)
            break

    return matches, matched_s, matched_l


def pass2_normalised_ref(
    statement: list[StatementLine],
    ledger: list[LedgerLine],
    supplier: str,
) -> tuple[list[Match], list[ProposedRule], set[str], set[str]]:
    """Normalised reference match: normalised_ref equal AND amounts equal.

    Confidence 0.95. When the raw refs differ but the normalised refs match,
    a normalisation rule (strip_prefix) is proposed for the supplier alongside
    the match, deduplicated by prefix value.

    Returns (matches, proposed_rules, matched_statement_ids, matched_ledger_ids).
    """
    matches: list[Match] = []
    rules: dict[tuple[str, str], ProposedRule] = {}
    matched_s: set[str] = set()
    matched_l: set[str] = set()

    ledger_by_norm: dict[str, list[LedgerLine]] = {}
    for line in ledger:
        if line.normalised_ref:
            ledger_by_norm.setdefault(line.normalised_ref, []).append(line)
    for candidates in ledger_by_norm.values():
        candidates.sort(key=lambda l: (l.doc_date, l.id))

    for s_line in sorted(statement, key=lambda s: (s.doc_date, s.id)):
        if not s_line.normalised_ref:
            continue
        for l_line in ledger_by_norm.get(s_line.normalised_ref, []):
            if l_line.id in matched_l:
                continue
            if s_line.amount != l_line.open_amount:
                continue
            matches.append(
                Match(
                    statement_line_ids=(s_line.id,),
                    ledger_line_ids=(l_line.id,),
                    method="normalised_ref",
                    confidence="0.95",
                    amount_delta=0,
                )
            )
            matched_s.add(s_line.id)
            matched_l.add(l_line.id)
            if s_line.raw_ref != l_line.raw_ref:
                prefix = alpha_prefix(l_line.raw_ref) or alpha_prefix(s_line.raw_ref)
                if prefix:
                    key = ("strip_prefix", prefix)
                    existing = rules.get(key)
                    rules[key] = ProposedRule(
                        supplier=supplier,
                        kind="strip_prefix",
                        value=prefix,
                        statement_line_ids=tuple(
                            sorted((existing.statement_line_ids if existing else ()) + (s_line.id,))
                        ),
                        ledger_line_ids=tuple(
                            sorted((existing.ledger_line_ids if existing else ()) + (l_line.id,))
                        ),
                    )
            break

    proposed = [rules[key] for key in sorted(rules)]
    return matches, proposed, matched_s, matched_l


@dataclass(frozen=True)
class RefLink:
    """A statement/ledger pair whose references match but amounts differ.

    Not a Match: routed to Pass 6, which classifies it as PART_PAYMENT,
    AMOUNT_MISMATCH or CURRENCY_MISMATCH using the preserved link.
    """

    statement_line_id: str
    ledger_line_id: str
    via: str  # "exact_ref" | "normalised_ref"


def pass3_ref_amount_differ(
    statement: list[StatementLine],
    ledger: list[LedgerLine],
) -> tuple[list[RefLink], set[str], set[str]]:
    """Reference matches (raw, else normalised) but amounts differ.

    Pairs are consumed (excluded from Passes 4-5) but produce no Match;
    the link is preserved for classification in Pass 6.

    Returns (links, consumed_statement_ids, consumed_ledger_ids).
    """
    links: list[RefLink] = []
    consumed_s: set[str] = set()
    consumed_l: set[str] = set()

    by_raw: dict[str, list[LedgerLine]] = {}
    by_norm: dict[str, list[LedgerLine]] = {}
    for line in ledger:
        by_raw.setdefault(line.raw_ref, []).append(line)
        if line.normalised_ref:
            by_norm.setdefault(line.normalised_ref, []).append(line)
    for index in (by_raw, by_norm):
        for candidates in index.values():
            candidates.sort(key=lambda l: (l.doc_date, l.id))

    for s_line in sorted(statement, key=lambda s: (s.doc_date, s.id)):
        candidates = [(l, "exact_ref") for l in by_raw.get(s_line.raw_ref, [])]
        if not candidates and s_line.normalised_ref:
            candidates = [
                (l, "normalised_ref") for l in by_norm.get(s_line.normalised_ref, [])
            ]
        for l_line, via in candidates:
            if l_line.id in consumed_l:
                continue
            links.append(RefLink(s_line.id, l_line.id, via))
            consumed_s.add(s_line.id)
            consumed_l.add(l_line.id)
            break

    return links, consumed_s, consumed_l


def pass4_amount_date(
    statement: list[StatementLine],
    ledger: list[LedgerLine],
    window_days: int = 5,
) -> tuple[list[Match], set[str], set[str]]:
    """Amount + date window match for lines with no usable reference.

    Applies only where the normalised reference is empty on the line's own
    side. Equal amount (statement amount vs ledger open_amount) with doc
    dates within +/- window_days. Confidence capped at 0.70 and every match
    is flagged requires_human_confirmation.

    Candidates are chosen deterministically: statement lines in (doc_date,
    id) order, each taking the unconsumed ledger line with the smallest date
    gap (ties broken by doc_date then id).

    Returns (matches, matched_statement_ids, matched_ledger_ids).
    """
    matches: list[Match] = []
    matched_s: set[str] = set()
    matched_l: set[str] = set()

    ledger_by_amount: dict[Cents, list[LedgerLine]] = {}
    for line in ledger:
        if line.normalised_ref:
            continue
        ledger_by_amount.setdefault(line.open_amount, []).append(line)

    for s_line in sorted(statement, key=lambda s: (s.doc_date, s.id)):
        if s_line.normalised_ref:
            continue
        candidates = [
            l
            for l in ledger_by_amount.get(s_line.amount, [])
            if l.id not in matched_l
            and abs((l.doc_date - s_line.doc_date).days) <= window_days
        ]
        if not candidates:
            continue
        best = min(
            candidates,
            key=lambda l: (abs((l.doc_date - s_line.doc_date).days), l.doc_date, l.id),
        )
        matches.append(
            Match(
                statement_line_ids=(s_line.id,),
                ledger_line_ids=(best.id,),
                method="amount_date",
                confidence="0.70",
                amount_delta=0,
                requires_human_confirmation=True,
            )
        )
        matched_s.add(s_line.id)
        matched_l.add(best.id)

    return matches, matched_s, matched_l


def _first_subset_summing_to(
    lines: list, target: Cents, max_size: int, amount_of
) -> tuple | None:
    """Smallest, lexicographically-first subset (size 2..max_size) summing to
    target. Lines must already be in deterministic order."""
    for size in range(2, min(max_size, len(lines)) + 1):
        for combo in combinations(lines, size):
            if sum(amount_of(l) for l in combo) == target:
                return combo
    return None


def pass5_subset_sums(
    statement: list[StatementLine],
    ledger: list[LedgerLine],
    max_size: int = 6,
) -> tuple[list[Match], set[str], set[str]]:
    """Bounded subset-sum over remaining residuals, both directions.

    Direction A: N ledger lines (2..max_size) summing to 1 statement line.
    Direction B: N statement lines (2..max_size) summing to 1 ledger line.
    Confidence capped at 0.65, always flagged for human confirmation.

    Deterministic: targets processed in (doc_date, id) order; candidate pools
    kept in (doc_date, id) order; the smallest, lexicographically-first
    subset wins. Lines consumed by a match leave the pool immediately.

    Returns (matches, matched_statement_ids, matched_ledger_ids).
    """
    matches: list[Match] = []
    matched_s: set[str] = set()
    matched_l: set[str] = set()

    s_sorted = sorted(statement, key=lambda s: (s.doc_date, s.id))
    l_sorted = sorted(ledger, key=lambda l: (l.doc_date, l.id))

    # Direction A: N ledger -> 1 statement
    for s_line in s_sorted:
        pool = [l for l in l_sorted if l.id not in matched_l]
        combo = _first_subset_summing_to(
            pool, s_line.amount, max_size, lambda l: l.open_amount
        )
        if combo is None:
            continue
        matches.append(
            Match(
                statement_line_ids=(s_line.id,),
                ledger_line_ids=tuple(sorted(l.id for l in combo)),
                method="subset_sum",
                confidence="0.65",
                amount_delta=0,
                requires_human_confirmation=True,
            )
        )
        matched_s.add(s_line.id)
        matched_l.update(l.id for l in combo)

    # Direction B: N statement -> 1 ledger
    for l_line in l_sorted:
        if l_line.id in matched_l:
            continue
        pool = [s for s in s_sorted if s.id not in matched_s]
        combo = _first_subset_summing_to(
            pool, l_line.open_amount, max_size, lambda s: s.amount
        )
        if combo is None:
            continue
        matches.append(
            Match(
                statement_line_ids=tuple(sorted(s.id for s in combo)),
                ledger_line_ids=(l_line.id,),
                method="subset_sum",
                confidence="0.65",
                amount_delta=0,
                requires_human_confirmation=True,
            )
        )
        matched_l.add(l_line.id)
        matched_s.update(s.id for s in combo)

    return matches, matched_s, matched_l
