"""tieout reconcile — command-line entry point."""
from __future__ import annotations

import argparse
import sys
from datetime import date

from .engine import Config, reconcile
from .loader import load_ledger_csv, load_statement_csv
from .serialize import render_text, to_json


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="tieout")
    sub = parser.add_subparsers(dest="command", required=True)

    rec = sub.add_parser("reconcile", help="reconcile a supplier statement against the AP ledger")
    rec.add_argument("--statement", required=True, help="statement CSV path")
    rec.add_argument("--ledger", required=True, help="AP open-items export CSV path")
    rec.add_argument("--supplier", required=True, help="supplier name as it appears in the ledger")
    rec.add_argument("--as-at", required=True, help="statement as-at date (YYYY-MM-DD)")
    rec.add_argument("--ledger-as-at", default=None, help="ledger as-at date if it differs (YYYY-MM-DD)")
    rec.add_argument("--json", action="store_true", help="emit machine-readable JSON")

    args = parser.parse_args(argv)

    statement = load_statement_csv(args.statement)
    ledger = load_ledger_csv(args.ledger)
    as_at = date.fromisoformat(args.as_at)
    ledger_as_at = date.fromisoformat(args.ledger_as_at) if args.ledger_as_at else None

    result = reconcile(
        statement,
        ledger,
        supplier=args.supplier,
        as_at=as_at,
        config=Config(),
        ledger_as_at=ledger_as_at,
    )

    if args.json:
        sys.stdout.write(to_json(result))
    else:
        sys.stdout.write(render_text(result))

    return 0 if result.bridge.ties_out else 1


if __name__ == "__main__":
    raise SystemExit(main())
