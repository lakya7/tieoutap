from datetime import date

from tieout.models import LedgerLine, StatementLine
from tieout.normalise import normalise_ref
from tieout.passes import pass3_ref_amount_differ


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


def test_ref_match_amount_differ_produces_link_not_match():
    statement = [_stmt("S1", "88741", date(2026, 7, 8), 326_000)]
    ledger = [_ledger("L1", "88741", date(2026, 7, 10), 302_600)]
    links, cs, cl = pass3_ref_amount_differ(statement, ledger)
    assert len(links) == 1
    link = links[0]
    assert link.statement_line_id == "S1"
    assert link.ledger_line_id == "L1"
    assert link.via == "exact_ref"
    assert cs == {"S1"} and cl == {"L1"}


def test_part_payment_shape_is_linked():
    # statement 12450.00 vs ledger open 2450.00 (original 12450.00)
    statement = [_stmt("S1", "88367", date(2026, 6, 11), 1_245_000)]
    ledger = [_ledger("L1", "88367", date(2026, 6, 13), 245_000, original=1_245_000)]
    links, _, _ = pass3_ref_amount_differ(statement, ledger)
    assert len(links) == 1


def test_normalised_ref_link():
    statement = [_stmt("S1", "88512", date(2026, 6, 19), 218_000)]
    ledger = [_ledger("L1", "MER-88512", date(2026, 6, 21), 200_000)]
    links, _, _ = pass3_ref_amount_differ(statement, ledger)
    assert len(links) == 1
    assert links[0].via == "normalised_ref"


def test_no_link_when_refs_do_not_match():
    statement = [_stmt("S1", "11111", date(2026, 6, 19), 218_000)]
    ledger = [_ledger("L1", "22222", date(2026, 6, 21), 218_000)]
    links, cs, cl = pass3_ref_amount_differ(statement, ledger)
    assert links == []
    assert cs == set() and cl == set()


def test_deterministic_regardless_of_input_order():
    statement = [
        _stmt("S1", "88741", date(2026, 7, 8), 326_000),
        _stmt("S2", "88367", date(2026, 6, 11), 1_245_000),
    ]
    ledger = [
        _ledger("L1", "88741", date(2026, 7, 10), 302_600),
        _ledger("L2", "88367", date(2026, 6, 13), 245_000, original=1_245_000),
    ]
    a = pass3_ref_amount_differ(statement, ledger)
    b = pass3_ref_amount_differ(list(reversed(statement)), list(reversed(ledger)))
    assert a == b
