"""Reconciliation cascade orchestrator.

Order is a correctness requirement:
  Pass 0 duplicates -> 1 exact ref -> 2 normalised ref -> 3 ref-match/amount-differ
  -> 4 amount+date -> 5 subset sums -> 6 classify residuals -> bridge.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from .models import LedgerLine, ReconcileResult, StatementLine


@dataclass(frozen=True)
class Config:
    duplicate_window_days: int = 30
    duplicate_tight_days: int = 7
    amount_date_window_days: int = 5
    timing_days: int = 3
    subset_max_size: int = 6
    as_at_tolerance_days: int = 0


def reconcile(
    statement: list[StatementLine],
    ledger: list[LedgerLine],
    supplier: str,
    as_at: date,
    config: Config = Config(),
) -> ReconcileResult:
    raise NotImplementedError("engine cascade not yet implemented (awaiting layout approval)")
