"""Deterministic serialisation: JSON and the human-readable text report.

Byte-identical output for identical inputs is a correctness requirement, so
JSON is emitted with sorted keys and money as fixed-point strings.
"""
from __future__ import annotations

import json
from dataclasses import asdict

from .models import BUCKET_ORDER, ReconcileResult
from .money import format_cents, format_cents_grouped


def _plain(obj, money: tuple[str, ...] = ()) -> dict:
    """Dataclass -> JSON-safe dict: money fields to fixed-point strings,
    tuples to lists."""
    out = {}
    for k, v in asdict(obj).items():
        if k in money:
            v = format_cents(v)
        elif isinstance(v, tuple):
            v = list(v)
        out[k] = v
    return out


def to_dict(result: ReconcileResult) -> dict:
    b = result.bridge
    return {
        "supplier": result.supplier,
        "as_at": result.as_at.isoformat(),
        "bridge_ties_out": b.ties_out,
        "diagnostic": result.diagnostic,
        "warnings": list(result.warnings),
        "matches": [_plain(m, ("amount_delta",)) for m in result.matches],
        "findings": [_plain(f, ("amount",)) for f in result.findings],
        "proposed_rules": [_plain(r) for r in result.proposed_rules],
        "bridge": {
            "ledger_open_total": format_cents(b.ledger_open_total),
            "statement_total": format_cents(b.statement_total),
            "ties_out": b.ties_out,
            "adjustments": [_plain(a, ("amount",)) for a in b.adjustments],
        },
    }


def to_json(result: ReconcileResult) -> str:
    return json.dumps(to_dict(result), sort_keys=True, indent=2) + "\n"


def render_text(result: ReconcileResult) -> str:
    out: list[str] = []
    out.append(f"TieOut AP — {result.supplier} as at {result.as_at.isoformat()}")
    out.append("")

    for w in result.warnings:
        out.append(f"WARNING: {w}")
    if result.warnings:
        out.append("")

    if result.diagnostic is not None:
        out.append(f"DIAGNOSTIC: {result.diagnostic}")
        out.append("")

    if result.findings:
        out.append("FINDINGS")
        for bucket in BUCKET_ORDER:
            in_bucket = [f for f in result.findings if f.bucket == bucket]
            if not in_bucket:
                continue
            out.append(f"  [{bucket}]")
            for f in in_bucket:
                ids = ",".join(f.statement_line_ids + f.ledger_line_ids)
                out.append(
                    f"    {f.type:<22} {format_cents_grouped(f.amount):>14}  "
                    f"lines={ids}  rule={f.rule_id}"
                )
        out.append("")

    if result.proposed_rules:
        out.append("PROPOSED NORMALISATION RULES")
        for r in result.proposed_rules:
            out.append(f"  {r.supplier}: {r.kind} {r.value!r}")
        out.append("")

    out.append("BRIDGE")
    out.append(f"  {format_cents_grouped(result.bridge.ledger_open_total):>14}  ledger open")
    for a in result.bridge.adjustments:
        signed = format_cents_grouped(a.amount)
        if a.amount >= 0:
            signed = "+" + signed
        out.append(f"  {signed:>14}  {a.ref}  {a.label}")
    out.append("  " + "-" * 14)
    tick = "OK ties out" if result.bridge.ties_out else "DOES NOT TIE"
    out.append(
        f"  {format_cents_grouped(result.bridge.statement_total):>14}  statement total  [{tick}]"
    )
    return "\n".join(out) + "\n"
