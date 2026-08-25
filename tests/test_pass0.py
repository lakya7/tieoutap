from datetime import date

from tieout.models import DUPLICATE, LedgerLine
from tieout.normalise import normalise_ref
from tieout.passes import pass0_duplicates


def _line(id, ref, doc_date, open_amount, po="", original=None, doc_type="INV"):
    return LedgerLine(
        id=id,
        supplier="MERIDIAN IND SUPPLIES",
        raw_ref=ref,
        normalised_ref=normalise_ref(ref),
        doc_date=doc_date,
        doc_type=doc_type,
        original_amount=original if original is not None else open_amount,
        open_amount=open_amount,
        currency="USD",
        po_number=po,
    )


def test_flags_duplicate_pair_and_excludes_extra():
    ledger = [
        _line("L1", "88690", date(2026, 7, 4), 790_500, po="45102"),
        _line("L2", "88690A", date(2026, 7, 7), 790_500, po="45102"),
    ]
    findings, excluded = pass0_duplicates(ledger)
    assert len(findings) == 1
    f = findings[0]
    assert f.type == DUPLICATE
    assert f.amount == 790_500
    assert f.ledger_line_ids == ("L2",)  # later line is the flagged extra
    assert excluded == {"L2"}
    # all three signals present: near refs, PO match, dates within 7 days
    assert f.evidence["confidence"] == "0.95"
    assert set(f.evidence["signals"]) == {
        "near_identical_refs",
        "po_match",
        "dates_within_tight_window",
    }


def test_same_amount_outside_window_not_flagged():
    ledger = [
        _line("L1", "10001", date(2026, 1, 5), 500_000),
        _line("L2", "20002", date(2026, 3, 20), 500_000),
    ]
    findings, excluded = pass0_duplicates(ledger)
    assert findings == []
    assert excluded == set()


def test_confidence_floor_without_signals():
    # same amount, 20 days apart, unrelated refs, no PO
    ledger = [
        _line("L1", "10001", date(2026, 6, 1), 250_000),
        _line("L2", "20002", date(2026, 6, 21), 250_000),
    ]
    findings, _ = pass0_duplicates(ledger)
    assert len(findings) == 1
    assert findings[0].evidence["confidence"] == "0.70"


def test_window_is_configurable():
    ledger = [
        _line("L1", "10001", date(2026, 6, 1), 250_000),
        _line("L2", "20002", date(2026, 6, 21), 250_000),
    ]
    findings, _ = pass0_duplicates(ledger, duplicate_window_days=10)
    assert findings == []


def test_deterministic_regardless_of_input_order():
    a = _line("L1", "88690", date(2026, 7, 4), 790_500, po="45102")
    b = _line("L2", "88690A", date(2026, 7, 7), 790_500, po="45102")
    f1, e1 = pass0_duplicates([a, b])
    f2, e2 = pass0_duplicates([b, a])
    assert f1 == f2
    assert e1 == e2
