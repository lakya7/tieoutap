"""CSV loading for Phase 1. Statement CSV is pre-parsed (hand-typed from a PDF)."""
from __future__ import annotations

import csv
from datetime import date
from pathlib import Path

from .models import LedgerLine, StatementLine
from .money import parse_amount
from .normalise import normalise_ref


def _parse_date(raw: str) -> date:
    return date.fromisoformat(raw.strip())


def load_statement_csv(path: str | Path) -> list[StatementLine]:
    lines: list[StatementLine] = []
    with open(path, newline="", encoding="utf-8") as f:
        for i, row in enumerate(csv.DictReader(f)):
            raw_ref = row["ref"].strip()
            lines.append(
                StatementLine(
                    id=f"S{i + 1}",
                    raw_ref=raw_ref,
                    normalised_ref=normalise_ref(raw_ref),
                    doc_date=_parse_date(row["date"]),
                    doc_type=row["type"].strip().upper(),
                    amount=parse_amount(row["amount"]),
                    currency=row.get("currency", "").strip().upper() or "USD",
                    po_number=(row.get("po") or "").strip(),
                )
            )
    return lines


def load_ledger_csv(path: str | Path) -> list[LedgerLine]:
    lines: list[LedgerLine] = []
    with open(path, newline="", encoding="utf-8") as f:
        for i, row in enumerate(csv.DictReader(f)):
            raw_ref = row["ref"].strip()
            lines.append(
                LedgerLine(
                    id=f"L{i + 1}",
                    supplier=row["supplier"].strip(),
                    raw_ref=raw_ref,
                    normalised_ref=normalise_ref(raw_ref),
                    doc_date=_parse_date(row["date"]),
                    doc_type=row["type"].strip().upper(),
                    original_amount=parse_amount(row["original"]),
                    open_amount=parse_amount(row["open"]),
                    currency=row.get("currency", "").strip().upper() or "USD",
                    po_number=(row.get("po") or "").strip(),
                )
            )
    return lines
