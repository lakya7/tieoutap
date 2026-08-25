from datetime import date

from tieout.models import (
    AMOUNT_MISMATCH,
    CASH_AT_RISK,
    CURRENCY_MISMATCH,
    EXPLAINED,
    INVESTIGATE,
    PART_PAYMENT,
    PAYMENT_NOT_APPLIED,
    SUPPLIER_OMISSION,
    TIMING,
    UNCLAIMED_CREDIT,
    UNRECORDED_LIABILITY,
    UNRECORDED_LIABILITY_BUCKET,
    LedgerLine,
    StatementLine,
)
from tieout.passes import RefLink, pass6_classify

AS_AT = date(2026, 7, 31)


def _ledger(id, ref, doc_date, open_amount, original=None, doc_type="INV", currency="USD"):
    return LedgerLine(
        id=id,
        supplier="MERIDIAN IND SUPPLIES",
        raw_ref=ref,
        normalised_ref=ref,
        doc_date=doc_date,
        doc_type=doc_type,
        original_amount=original if original is not None else open_amount,
        open_amount=open_amount,
        currency=currency,
        po_number="",
    )


def _stmt(id, ref, doc_date, amount, doc_type="INV", currency="USD"):
    return StatementLine(
        id=id,
        raw_ref=ref,
        normalised_ref=ref,
        doc_date=doc_date,
        doc_type=doc_type,
        amount=amount,
        currency=currency,
        po_number="",
    )


def _classify(residual_statement=(), residual_ledger=(), links=(), matches=(), extra_s=(), extra_l=()):
    s_by_id = {s.id: s for s in list(residual_statement) + list(extra_s)}
    l_by_id = {l.id: l for l in list(residual_ledger) + list(extra_l)}
    return pass6_classify(
        list(residual_statement),
        list(residual_ledger),
        list(links),
        list(matches),
        s_by_id,
        l_by_id,
        AS_AT,
    )


def test_unclaimed_credit():
    s = _stmt("S1", "1147", date(2026, 6, 24), -276_000, doc_type="CRN")
    (f,) = _classify(residual_statement=[s])
    assert f.type == UNCLAIMED_CREDIT
    assert f.bucket == CASH_AT_RISK
    assert f.amount == 276_000
    assert f.evidence["bridge_delta"] == -276_000


def test_timing_when_after_cutoff():
    s = _stmt("S1", "88901", date(2026, 7, 29), 912_000)  # > 2026-07-28 cutoff
    (f,) = _classify(residual_statement=[s])
    assert f.type == TIMING
    assert f.bucket == EXPLAINED
    assert f.evidence["bridge_delta"] == 912_000


def test_unrecorded_liability_otherwise():
    s = _stmt("S1", "88802", date(2026, 7, 15), 1_578_000)
    (f,) = _classify(residual_statement=[s])
    assert f.type == UNRECORDED_LIABILITY
    assert f.bucket == UNRECORDED_LIABILITY_BUCKET
    assert f.amount == 1_578_000
    assert f.evidence["bridge_delta"] == 1_578_000


def test_part_payment_via_link():
    s = _stmt("S1", "88367", date(2026, 6, 11), 1_245_000)
    l = _ledger("L1", "88367", date(2026, 6, 13), 245_000, original=1_245_000)
    (f,) = _classify(links=[RefLink("S1", "L1", "exact_ref")], extra_s=[s], extra_l=[l])
    assert f.type == PART_PAYMENT
    assert f.bucket == EXPLAINED
    assert f.amount == 1_000_000
    assert f.evidence["bridge_delta"] == 1_000_000


def test_amount_mismatch_via_link():
    s = _stmt("S1", "88741", date(2026, 7, 8), 326_000)
    l = _ledger("L1", "88741", date(2026, 7, 10), 302_600)
    (f,) = _classify(links=[RefLink("S1", "L1", "exact_ref")], extra_s=[s], extra_l=[l])
    assert f.type == AMOUNT_MISMATCH
    assert f.bucket == INVESTIGATE
    assert f.amount == 23_400
    assert f.evidence["bridge_delta"] == 23_400


def test_payment_not_applied():
    l = _ledger("L1", "PAY-991", date(2026, 7, 20), -400_000, doc_type="PAY")
    (f,) = _classify(residual_ledger=[l])
    assert f.type == PAYMENT_NOT_APPLIED
    assert f.bucket == EXPLAINED
    assert f.amount == 400_000
    assert f.evidence["bridge_delta"] == 400_000


def test_supplier_omission():
    l = _ledger("L1", "77010", date(2026, 7, 5), 150_000)
    (f,) = _classify(residual_ledger=[l])
    assert f.type == SUPPLIER_OMISSION
    assert f.bucket == INVESTIGATE
    assert f.amount == 150_000
    assert f.evidence["bridge_delta"] == -150_000


def test_currency_mismatch_on_link_takes_priority():
    s = _stmt("S1", "88999", date(2026, 7, 8), 326_000, currency="EUR")
    l = _ledger("L1", "88999", date(2026, 7, 10), 302_600, currency="USD")
    (f,) = _classify(links=[RefLink("S1", "L1", "exact_ref")], extra_s=[s], extra_l=[l])
    assert f.type == CURRENCY_MISMATCH
    assert f.bucket == INVESTIGATE
    assert f.evidence["currencies"] == ["EUR", "USD"]


def test_no_findings_when_nothing_residual():
    assert _classify() == []


def test_every_finding_has_provenance_and_bridge_delta():
    s1 = _stmt("S1", "1147", date(2026, 6, 24), -276_000, doc_type="CRN")
    s2 = _stmt("S2", "88802", date(2026, 7, 15), 1_578_000)
    l1 = _ledger("L1", "77010", date(2026, 7, 5), 150_000)
    findings = _classify(residual_statement=[s1, s2], residual_ledger=[l1])
    assert len(findings) == 3
    for f in findings:
        assert f.rule_id.startswith("pass6.")
        assert "bridge_delta" in f.evidence
