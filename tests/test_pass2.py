from datetime import date

from tieout.models import LedgerLine, StatementLine
from tieout.normalise import normalise_ref
from tieout.passes import pass2_normalised_ref

SUPPLIER = "MERIDIAN IND SUPPLIES"


def _ledger(id, ref, doc_date, open_amount):
    return LedgerLine(
        id=id,
        supplier=SUPPLIER,
        raw_ref=ref,
        normalised_ref=normalise_ref(ref),
        doc_date=doc_date,
        doc_type="INV",
        original_amount=open_amount,
        open_amount=open_amount,
        currency="USD",
        po_number="",
    )


def _stmt(id, ref, doc_date, amount):
    return StatementLine(
        id=id,
        raw_ref=ref,
        normalised_ref=normalise_ref(ref),
        doc_date=doc_date,
        doc_type="INV",
        amount=amount,
        currency="USD",
        po_number="",
    )


def test_normalised_match_with_proposed_rule():
    statement = [_stmt("S1", "88512", date(2026, 6, 19), 218_000)]
    ledger = [_ledger("L1", "MER-88512", date(2026, 6, 21), 218_000)]
    matches, rules, ms, ml = pass2_normalised_ref(statement, ledger, SUPPLIER)
    assert len(matches) == 1
    m = matches[0]
    assert m.method == "normalised_ref"
    assert m.confidence == "0.95"
    assert m.amount_delta == 0
    assert ms == {"S1"} and ml == {"L1"}
    assert len(rules) == 1
    rule = rules[0]
    assert rule.supplier == SUPPLIER
    assert rule.kind == "strip_prefix"
    assert rule.value == "MER-"
    assert rule.statement_line_ids == ("S1",)
    assert rule.ledger_line_ids == ("L1",)


def test_statement_prefix_also_produces_rule():
    statement = [_stmt("S1", "INV-88512", date(2026, 6, 19), 218_000)]
    ledger = [_ledger("L1", "88512", date(2026, 6, 21), 218_000)]
    matches, rules, _, _ = pass2_normalised_ref(statement, ledger, SUPPLIER)
    assert len(matches) == 1
    assert len(rules) == 1
    assert rules[0].value == "INV-"


def test_no_rule_when_raw_refs_equal():
    # equal raw refs can reach Pass 2 only if Pass 1 skipped them; no rule then
    statement = [_stmt("S1", "88214", date(2026, 6, 3), 482_000)]
    ledger = [_ledger("L1", "88214", date(2026, 6, 5), 482_000)]
    _, rules, _, _ = pass2_normalised_ref(statement, ledger, SUPPLIER)
    assert rules == []


def test_amounts_must_still_be_equal():
    statement = [_stmt("S1", "88512", date(2026, 6, 19), 218_000)]
    ledger = [_ledger("L1", "MER-88512", date(2026, 6, 21), 999_900)]
    matches, rules, _, _ = pass2_normalised_ref(statement, ledger, SUPPLIER)
    assert matches == []
    assert rules == []


def test_rule_deduplicated_across_lines():
    statement = [
        _stmt("S1", "88512", date(2026, 6, 19), 218_000),
        _stmt("S2", "88600", date(2026, 6, 25), 100_000),
    ]
    ledger = [
        _ledger("L1", "MER-88512", date(2026, 6, 21), 218_000),
        _ledger("L2", "MER-88600", date(2026, 6, 27), 100_000),
    ]
    matches, rules, _, _ = pass2_normalised_ref(statement, ledger, SUPPLIER)
    assert len(matches) == 2
    assert len(rules) == 1
    assert rules[0].statement_line_ids == ("S1", "S2")
    assert rules[0].ledger_line_ids == ("L1", "L2")


def test_deterministic_regardless_of_input_order():
    statement = [
        _stmt("S1", "88512", date(2026, 6, 19), 218_000),
        _stmt("S2", "88600", date(2026, 6, 25), 100_000),
    ]
    ledger = [
        _ledger("L1", "MER-88512", date(2026, 6, 21), 218_000),
        _ledger("L2", "MER-88600", date(2026, 6, 27), 100_000),
    ]
    a = pass2_normalised_ref(statement, ledger, SUPPLIER)
    b = pass2_normalised_ref(list(reversed(statement)), list(reversed(ledger)), SUPPLIER)
    assert a == b
