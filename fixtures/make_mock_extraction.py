"""Build a mock RawExtraction payload from the golden statement CSV, for
exercising the /api/extract endpoint without calling a vision model.

Usage: TIEOUT_MOCK_EXTRACTION="$(python3 fixtures/make_mock_extraction.py)" npm run dev
"""

import csv
import json
import pathlib
from decimal import Decimal

CSV = pathlib.Path(__file__).with_name("meridian_stmt.csv")


def main() -> None:
    lines = []
    total = Decimal("0")
    with CSV.open(newline="") as fh:
        for i, row in enumerate(csv.DictReader(fh)):
            amount = Decimal(row["amount"])
            total += amount
            lines.append(
                {
                    "ref": row["ref"],
                    "date": row["date"],
                    "doc_type": row["type"],
                    "amount_text": f"({-amount:,.2f})" if amount < 0 else f"{amount:,.2f}",
                    "po": row["po"],
                    "currency": "USD",
                    "box": {
                        "page": 1,
                        "x": 0.08,
                        "y": round(0.2 + i * 0.05, 4),
                        "width": 0.84,
                        "height": 0.04,
                    },
                }
            )
    print(
        json.dumps(
            {
                "supplier": "MERIDIAN IND SUPPLIES",
                "as_at": "2026-07-31",
                "stated_closing_balance_text": f"{total:,.2f}",
                "balance_forward": False,
                "lines": lines,
            }
        )
    )


if __name__ == "__main__":
    main()
