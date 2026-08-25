from datetime import date

from tieout.models import LedgerLine, StatementLine
from tieout.passes import pass5_subset_sums


def _ledger(id, ref, doc_date, open_amount):
    return LedgerLine(
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
        normalised_ref=ref,
        doc_date=doc_date,
        doc_type="INV",
        amount=amount,
        currency="USD",
        po_number="",
    )


def test_n_ledger_to_one_statement():
    # one 12,000 statement line covered by ledger lines of 5,000 and 7,000
    # must produce ONE match, not three findings
    statement = [_stmt("S1", "CONS-1", date(2026, 7, 1), 1_200_000)]
    ledger = [
        _ledger("L1", "A1", date(2026, 6, 28), 500_000),
        _ledger("L2", "A2", date(2026, 6, 29), 700_000),
    ]
    matches, ms, ml = pass5_subset_sums(statement, ledger)
    assert len(matches) == 1
    m = matches[0]
    assert m.method == "subset_sum"
    assert m.confidence == "0.65"
    assert m.requires_human_confirmation is True
    assert m.statement_line_ids == ("S1",)
    assert m.ledger_line_ids == ("L1", "L2")
    assert ms == {"S1"} and ml == {"L1", "L2"}


def test_one_ledger_to_n_statement():
    statement = [
        _stmt("S1", "B1", date(2026, 7, 1), 300_000),
        _stmt("S2", "B2", date(2026, 7, 2), 450_000),
    ]
    ledger = [_ledger("L1", "SPLIT-1", date(2026, 7, 1), 750_000)]
    matches, ms, ml = pass5_subset_sums(statement, ledger)
    assert len(matches) == 1
    m = matches[0]
    assert m.statement_line_ids == ("S1", "S2")
    assert m.ledger_line_ids == ("L1",)


def test_subset_size_capped():
    statement = [_stmt("S1", "C1", date(2026, 7, 1), 700_000)]
    ledger = [
        _ledger(f"L{i}", f"D{i}", date(2026, 7, 1), 100_000) for i in range(1, 8)
    ]
    matches, _, _ = pass5_subset_sums(statement, ledger, max_size=6)
    assert matches == []  # would need 7 lines; cap is 6


def test_no_match_when_no_subset_sums():
    statement = [_stmt("S1", "E1", date(2026, 7, 1), 1_000_000)]
    ledger = [
        _ledger("L1", "F1", date(2026, 6, 28), 300_000),
        _ledger("L2", "F2", date(2026, 6, 29), 400_000),
    ]
    matches, ms, ml = pass5_subset_sums(statement, ledger)
    assert matches == []
    assert ms == set() and ml == set()


def test_handles_negative_amounts():
    # invoice + credit note netting to the statement line
    statement = [_stmt("S1", "G1", date(2026, 7, 1), 800_000)]
    ledger = [
        _ledger("L1", "H1", date(2026, 6, 28), 1_000_000),
        _ledger("L2", "H2", date(2026, 6, 29), -200_000),
    ]
    matches, _, _ = pass5_subset_sums(statement, ledger)
    assert len(matches) == 1
    assert matches[0].ledger_line_ids == ("L1", "L2")


def test_deterministic_regardless_of_input_order():
    statement = [_stmt("S1", "CONS-1", date(2026, 7, 1), 1_200_000)]
    ledger = [
        _ledger("L1", "A1", date(2026, 6, 28), 500_000),
        _ledger("L2", "A2", date(2026, 6, 29), 700_000),
    ]
    a = pass5_subset_sums(statement, ledger)
    b = pass5_subset_sums(list(reversed(statement)), list(reversed(ledger)))
    assert a == b
