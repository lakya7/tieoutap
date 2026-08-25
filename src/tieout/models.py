"""Core data structures. Money is always integer minor units (cents) — never float."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

Cents = int  # signed integer minor units

# Finding types
DUPLICATE = "DUPLICATE"
UNCLAIMED_CREDIT = "UNCLAIMED_CREDIT"
TIMING = "TIMING"
UNRECORDED_LIABILITY = "UNRECORDED_LIABILITY"
PART_PAYMENT = "PART_PAYMENT"
AMOUNT_MISMATCH = "AMOUNT_MISMATCH"
PAYMENT_NOT_APPLIED = "PAYMENT_NOT_APPLIED"
SUPPLIER_OMISSION = "SUPPLIER_OMISSION"
CURRENCY_MISMATCH = "CURRENCY_MISMATCH"

# Buckets, in fixed report order
CASH_AT_RISK = "cash_at_risk"
UNRECORDED_LIABILITY_BUCKET = "unrecorded_liability"
INVESTIGATE = "investigate"
EXPLAINED = "explained"
BUCKET_ORDER = (CASH_AT_RISK, UNRECORDED_LIABILITY_BUCKET, INVESTIGATE, EXPLAINED)


@dataclass(frozen=True)
class LedgerLine:
    id: str
    supplier: str
    raw_ref: str
    normalised_ref: str
    doc_date: date
    doc_type: str  # "INV" | "CRN" | "PAY"
    original_amount: Cents
    open_amount: Cents
    currency: str
    po_number: str


@dataclass(frozen=True)
class StatementLine:
    id: str
    raw_ref: str
    normalised_ref: str
    doc_date: date
    doc_type: str
    amount: Cents
    currency: str
    po_number: str


@dataclass(frozen=True)
class Match:
    # Lists on both sides: consolidated invoices (1:N) and split postings (N:1)
    # are normal. Stored as sorted tuples for hashability and determinism.
    statement_line_ids: tuple[str, ...]
    ledger_line_ids: tuple[str, ...]
    method: str  # "exact_ref" | "normalised_ref" | "amount_date" | "subset_sum"
    confidence: str  # fixed-point 2dp string ("1.00", "0.95", ...) — never float
    amount_delta: Cents
    requires_human_confirmation: bool = False


@dataclass(frozen=True)
class Finding:
    type: str
    bucket: str
    amount: Cents  # magnitude as reported (sign per finding-type convention)
    statement_line_ids: tuple[str, ...]
    ledger_line_ids: tuple[str, ...]
    rule_id: str  # provenance: the rule that produced this finding
    evidence: dict = field(default_factory=dict, compare=False)


@dataclass(frozen=True)
class ProposedRule:
    supplier: str
    kind: str  # e.g. "strip_prefix"
    value: str  # e.g. "MER-"
    statement_line_ids: tuple[str, ...]
    ledger_line_ids: tuple[str, ...]


@dataclass(frozen=True)
class BridgeAdjustment:
    label: str  # short human label, e.g. "88367 part payment applied by us, not by supplier"
    ref: str
    finding_type: str
    amount: Cents  # signed: ledger_total + sum(adjustments) == statement_total


@dataclass(frozen=True)
class Bridge:
    ledger_open_total: Cents
    statement_total: Cents
    adjustments: tuple[BridgeAdjustment, ...]
    ties_out: bool


@dataclass(frozen=True)
class ReconcileResult:
    supplier: str
    as_at: date
    matches: tuple[Match, ...]
    findings: tuple[Finding, ...]  # empty when bridge does not tie out
    proposed_rules: tuple[ProposedRule, ...]
    bridge: Bridge
    warnings: tuple[str, ...]
    diagnostic: str | None  # set when bridge fails; findings suppressed
