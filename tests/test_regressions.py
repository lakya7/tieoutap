"""Regression tests required by the spec: ordering, determinism, bridge
failure suppression, no floats in the money path, and as-at date tolerance."""
from __future__ import annotations

import ast
import random
from datetime import date
from pathlib import Path

from tieout import load_ledger_csv, load_statement_csv, reconcile
from tieout.models import DUPLICATE, Bridge, LedgerLine, StatementLine
from tieout.normalise import normalise_ref
from tieout.passes import pass0_duplicates, pass1_exact_ref
from tieout.serialize import to_json

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
SUPPLIER = "MERIDIAN IND SUPPLIES"
AS_AT = date(2026, 7, 31)
SRC = Path(__file__).resolve().parent.parent / "src" / "tieout"


def _ledger(id, ref, doc_date, open_amount, po=""):
    return LedgerLine(
        id=id, supplier=SUPPLIER, raw_ref=ref, normalised_ref=normalise_ref(ref),
        doc_date=doc_date, doc_type="INV", original_amount=open_amount,
        open_amount=open_amount, currency="USD", po_number=po,
    )


def _stmt(id, ref, doc_date, amount):
    return StatementLine(
        id=id, raw_ref=ref, normalised_ref=normalise_ref(ref), doc_date=doc_date,
        doc_type="INV", amount=amount, currency="USD", po_number="",
    )


def _load():
    return (
        load_statement_csv(FIXTURES / "meridian_stmt.csv"),
        load_ledger_csv(FIXTURES / "acme_ledger.csv"),
    )


def test_ordering_matching_before_pass0_would_miss_the_duplicate():
    """If Pass 1 ran before Pass 0, the statement line would consume one of
    the duplicate pair and the duplicate would become undetectable."""
    statement = [_stmt("S1", "88690", date(2026, 7, 2), 790_500)]
    ledger = [
        _ledger("L1", "88690", date(2026, 7, 4), 790_500, po="45102"),
        _ledger("L2", "88690A", date(2026, 7, 7), 790_500, po="45102"),
    ]

    # Wrong order: match first, then scan the leftovers for duplicates.
    _, _, matched_l = pass1_exact_ref(statement, ledger)
    leftovers = [l for l in ledger if l.id not in matched_l]
    wrong_order_findings, _ = pass0_duplicates(leftovers)
    assert wrong_order_findings == []  # duplicate missed

    # Correct order (the engine's): Pass 0 first still flags it.
    result = reconcile(statement, ledger, supplier=SUPPLIER, as_at=AS_AT)
    assert [f.type for f in result.findings if f.type == DUPLICATE] == [DUPLICATE]


def test_shuffled_input_rows_produce_byte_identical_output():
    statement, ledger = _load()
    baseline = to_json(reconcile(statement, ledger, supplier=SUPPLIER, as_at=AS_AT))
    for seed in (1, 7, 42):
        s, l = list(statement), list(ledger)
        random.Random(seed).shuffle(s)
        random.Random(seed).shuffle(l)
        assert to_json(reconcile(s, l, supplier=SUPPLIER, as_at=AS_AT)) == baseline


def test_bridge_failure_suppresses_findings(monkeypatch):
    """A bridge that does not tie must suppress findings and set a diagnostic."""
    import tieout.engine as engine

    def broken_bridge(findings, ledger_open_total, statement_total, s_by_id, l_by_id):
        return Bridge(ledger_open_total, statement_total, (), ties_out=False)

    monkeypatch.setattr(engine, "build_bridge", broken_bridge)
    statement, ledger = _load()
    result = engine.reconcile(statement, ledger, supplier=SUPPLIER, as_at=AS_AT)
    assert result.bridge.ties_out is False
    assert result.findings == ()
    assert result.diagnostic is not None
    assert "does not tie out" in result.diagnostic


def test_no_floats_in_money_path():
    """No float literals and no float() calls anywhere in the engine source."""
    for path in sorted(SRC.glob("*.py")):
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, float):
                raise AssertionError(f"float literal in {path.name}:{node.lineno}")
            if isinstance(node, ast.Name) and node.id == "float":
                raise AssertionError(f"float() used in {path.name}:{node.lineno}")


def test_differing_as_at_dates_produce_warning():
    statement, ledger = _load()
    result = reconcile(
        statement, ledger, supplier=SUPPLIER, as_at=AS_AT,
        ledger_as_at=date(2026, 8, 5),
    )
    assert len(result.warnings) == 1
    assert "2026-08-05" in result.warnings[0]
    assert "timing" in result.warnings[0]


def test_equal_as_at_dates_produce_no_warning():
    statement, ledger = _load()
    result = reconcile(
        statement, ledger, supplier=SUPPLIER, as_at=AS_AT, ledger_as_at=AS_AT
    )
    assert result.warnings == ()
