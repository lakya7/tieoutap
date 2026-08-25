"""Golden fixture: Meridian Industrial Supplies vs Acme AP ledger, as at 2026-07-31.

Written before the engine. Exactly six findings plus one proposed normalisation
rule, and a bridge that ties to 59,165.00 to the penny.
"""
from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest

from tieout import load_ledger_csv, load_statement_csv, reconcile
from tieout.models import (
    AMOUNT_MISMATCH,
    CASH_AT_RISK,
    DUPLICATE,
    EXPLAINED,
    INVESTIGATE,
    PART_PAYMENT,
    TIMING,
    UNCLAIMED_CREDIT,
    UNRECORDED_LIABILITY,
    UNRECORDED_LIABILITY_BUCKET,
)

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
SUPPLIER = "MERIDIAN IND SUPPLIES"
AS_AT = date(2026, 7, 31)

STATEMENT_TOTAL = 5_916_500  # 59,165.00 in cents
LEDGER_OPEN_TOTAL = 3_469_600  # 34,696.00 in cents


@pytest.fixture(scope="module")
def result():
    statement = load_statement_csv(FIXTURES / "meridian_stmt.csv")
    ledger = load_ledger_csv(FIXTURES / "acme_ledger.csv")
    return reconcile(statement, ledger, supplier=SUPPLIER, as_at=AS_AT)


def _refs(result, finding):
    """(statement raw_refs, ledger raw_refs) for a finding, via its line ids."""
    statement = load_statement_csv(FIXTURES / "meridian_stmt.csv")
    ledger = load_ledger_csv(FIXTURES / "acme_ledger.csv")
    s_by_id = {line.id: line.raw_ref for line in statement}
    l_by_id = {line.id: line.raw_ref for line in ledger}
    return (
        tuple(sorted(s_by_id[i] for i in finding.statement_line_ids)),
        tuple(sorted(l_by_id[i] for i in finding.ledger_line_ids)),
    )


def test_bridge_ties_to_the_penny(result):
    assert result.bridge.ties_out is True
    assert result.bridge.ledger_open_total == LEDGER_OPEN_TOTAL
    assert result.bridge.statement_total == STATEMENT_TOTAL
    adjustments = sum(a.amount for a in result.bridge.adjustments)
    assert LEDGER_OPEN_TOTAL + adjustments == STATEMENT_TOTAL
    assert result.diagnostic is None


def test_exactly_six_findings(result):
    assert len(result.findings) == 6


def test_findings_content(result):
    got = {
        (f.type, f.bucket, f.amount) + _refs(result, f)
        for f in result.findings
    }
    expected = {
        (DUPLICATE, CASH_AT_RISK, 790_500, (), ("88690A",)),
        (UNCLAIMED_CREDIT, CASH_AT_RISK, 276_000, ("1147",), ()),
        (UNRECORDED_LIABILITY, UNRECORDED_LIABILITY_BUCKET, 1_578_000, ("88802",), ()),
        (PART_PAYMENT, EXPLAINED, 1_000_000, ("88367",), ("88367",)),
        (AMOUNT_MISMATCH, INVESTIGATE, 23_400, ("88741",), ("88741",)),
        (TIMING, EXPLAINED, 912_000, ("88901",), ()),
    }
    assert got == expected


def test_every_finding_has_provenance(result):
    for f in result.findings:
        assert f.rule_id
        assert f.statement_line_ids or f.ledger_line_ids


def test_matches(result):
    """88214, 88690, 88855 match exactly; 88512 matches MER-88512 via normalisation."""
    statement = load_statement_csv(FIXTURES / "meridian_stmt.csv")
    ledger = load_ledger_csv(FIXTURES / "acme_ledger.csv")
    s_by_id = {line.id: line.raw_ref for line in statement}
    l_by_id = {line.id: line.raw_ref for line in ledger}
    got = {
        (
            tuple(sorted(s_by_id[i] for i in m.statement_line_ids)),
            tuple(sorted(l_by_id[i] for i in m.ledger_line_ids)),
            m.method,
        )
        for m in result.matches
        if m.method in ("exact_ref", "normalised_ref")
    }
    assert (("88214",), ("88214",), "exact_ref") in got
    assert (("88690",), ("88690",), "exact_ref") in got
    assert (("88855",), ("88855",), "exact_ref") in got
    assert (("88512",), ("MER-88512",), "normalised_ref") in got


def test_normalisation_rule_proposed(result):
    assert len(result.proposed_rules) == 1
    rule = result.proposed_rules[0]
    assert rule.supplier == SUPPLIER
    assert rule.kind == "strip_prefix"
    assert rule.value == "MER-"


def test_bridge_adjustment_amounts(result):
    amounts = sorted(a.amount for a in result.bridge.adjustments)
    assert amounts == sorted([1_000_000, -276_000, -790_500, 23_400, 1_578_000, 912_000])
