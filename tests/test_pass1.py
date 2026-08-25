from datetime import date

from tieout.models import LedgerLine, StatementLine
from tieout.normalise import normalise_ref
from tieout.passes import pass1_exact_ref


def _ledger(id, ref, doc_date, open_amount, original=None):
    return LedgerLine(
        id=id,
        supplier="MERIDIAN IND SUPPLIES",
        raw_ref=ref,
        normalised_ref=normalise_ref(ref),
        doc_date=doc_date,
        doc_type="INV",
        original_amount=original if original is not None else open_amount,
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


def test_exact_ref_and_amount_matches():
    statement = [_stmt("S1", "88214", date(2026, 6, 3), 482_000)]
    ledger = [_ledger("L1", "88214", date(2026, 6, 5), 482_000)]
    matches, ms, ml = pass1_exact_ref(statement, ledger)
    assert len(matches) == 1
    m = matches[0]
    assert m.statement_line_ids == ("S1",)
    assert m.ledger_line_ids == ("L1",)
    assert m.method == "exact_ref"
    assert m.confidence == "1.00"
    assert m.amount_delta == 0
    assert ms == {"S1"} and ml == {"L1"}


def test_same_ref_different_amount_is_not_a_match():
    statement = [_stmt("S1", "88741", date(2026, 7, 8), 326_000)]
    ledger = [_ledger("L1", "88741", date(2026, 7, 10), 302_600)]
    matches, ms, ml = pass1_exact_ref(statement, ledger)
    assert matches == []
    assert ms == set() and ml == set()


def test_different_ref_same_amount_is_not_a_match():
    statement = [_stmt("S1", "88512", date(2026, 6, 19), 218_000)]
    ledger = [_ledger("L1", "MER-88512", date(2026, 6, 21), 218_000)]
    matches, _, _ = pass1_exact_ref(statement, ledger)
    assert matches == []


def test_ledger_line_consumed_at_most_once():
    statement = [
        _stmt("S1", "77001", date(2026, 6, 1), 100_000),
        _stmt("S2", "77001", date(2026, 6, 2), 100_000),
    ]
    ledger = [_ledger("L1", "77001", date(2026, 6, 1), 100_000)]
    matches, ms, ml = pass1_exact_ref(statement, ledger)
    assert len(matches) == 1
    assert matches[0].statement_line_ids == ("S1",)  # earliest statement line wins
    assert ml == {"L1"}


def test_deterministic_regardless_of_input_order():
    statement = [
        _stmt("S1", "77001", date(2026, 6, 1), 100_000),
        _stmt("S2", "77002", date(2026, 6, 2), 200_000),
    ]
    ledger = [
        _ledger("L1", "77001", date(2026, 6, 3), 100_000),
        _ledger("L2", "77002", date(2026, 6, 4), 200_000),
    ]
    a = pass1_exact_ref(statement, ledger)
    b = pass1_exact_ref(list(reversed(statement)), list(reversed(ledger)))
    assert a == b
