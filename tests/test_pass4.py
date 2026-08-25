from datetime import date

from tieout.models import LedgerLine, StatementLine
from tieout.passes import pass4_amount_date


def _ledger(id, ref, doc_date, open_amount):
    return LedgerLine(
        id=id,
        supplier="MERIDIAN IND SUPPLIES",
        raw_ref=ref,
        normalised_ref="",  # no usable reference
        doc_date=doc_date,
        doc_type="INV",
        original_amount=open_amount,
        open_amount=open_amount,
        currency="USD",
        po_number="",
    ) if ref == "" else LedgerLine(
        id=id,
        supplier="MERIDIAN IND SUPPLIES",
        raw_ref=ref,
        normalised_ref=ref,
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
        normalised_ref="" if ref == "" else ref,
        doc_date=doc_date,
        doc_type="INV",
        amount=amount,
        currency="USD",
        po_number="",
    )


def test_matches_equal_amount_within_window():
    statement = [_stmt("S1", "", date(2026, 7, 1), 500_000)]
    ledger = [_ledger("L1", "", date(2026, 7, 4), 500_000)]
    matches, ms, ml = pass4_amount_date(statement, ledger)
    assert len(matches) == 1
    m = matches[0]
    assert m.method == "amount_date"
    assert m.confidence == "0.70"
    assert m.requires_human_confirmation is True
    assert ms == {"S1"} and ml == {"L1"}


def test_outside_window_not_matched():
    statement = [_stmt("S1", "", date(2026, 7, 1), 500_000)]
    ledger = [_ledger("L1", "", date(2026, 7, 8), 500_000)]
    matches, _, _ = pass4_amount_date(statement, ledger, window_days=5)
    assert matches == []


def test_lines_with_references_are_skipped():
    statement = [_stmt("S1", "88214", date(2026, 7, 1), 500_000)]
    ledger = [_ledger("L1", "", date(2026, 7, 2), 500_000)]
    matches, _, _ = pass4_amount_date(statement, ledger)
    assert matches == []


def test_nearest_date_wins():
    statement = [_stmt("S1", "", date(2026, 7, 10), 500_000)]
    ledger = [
        _ledger("L1", "", date(2026, 7, 6), 500_000),
        _ledger("L2", "", date(2026, 7, 11), 500_000),
    ]
    matches, _, _ = pass4_amount_date(statement, ledger)
    assert len(matches) == 1
    assert matches[0].ledger_line_ids == ("L2",)


def test_deterministic_regardless_of_input_order():
    statement = [
        _stmt("S1", "", date(2026, 7, 1), 500_000),
        _stmt("S2", "", date(2026, 7, 3), 500_000),
    ]
    ledger = [
        _ledger("L1", "", date(2026, 7, 2), 500_000),
        _ledger("L2", "", date(2026, 7, 4), 500_000),
    ]
    a = pass4_amount_date(statement, ledger)
    b = pass4_amount_date(list(reversed(statement)), list(reversed(ledger)))
    assert a == b
