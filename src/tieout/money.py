"""Money parsing/formatting. Integer minor units only — float never touches money."""
from __future__ import annotations

from .models import Cents


def parse_amount(raw: str) -> Cents:
    """Parse a decimal string like '-12,450.00' into signed integer cents.

    Accepts optional thousands separators and 0-2 decimal places.
    Never constructs a float.
    """
    s = raw.strip().replace(",", "")
    if not s:
        raise ValueError("empty amount")
    sign = 1
    if s.startswith("-"):
        sign, s = -1, s[1:]
    elif s.startswith("+"):
        s = s[1:]
    if "." in s:
        whole, frac = s.split(".", 1)
    else:
        whole, frac = s, ""
    if len(frac) > 2 or not (whole or frac).isdigit() or (whole and not whole.isdigit()) or (frac and not frac.isdigit()):
        raise ValueError(f"bad amount: {raw!r}")
    frac = frac.ljust(2, "0")
    return sign * (int(whole or "0") * 100 + int(frac))


def format_cents(cents: Cents) -> str:
    """Format signed cents as a plain decimal string, e.g. -276000 -> '-2760.00'."""
    sign = "-" if cents < 0 else ""
    mag = abs(cents)
    return f"{sign}{mag // 100}.{mag % 100:02d}"


def format_cents_grouped(cents: Cents) -> str:
    """Format with thousands separators for the human report, e.g. 5916500 -> '59,165.00'."""
    sign = "-" if cents < 0 else ""
    mag = abs(cents)
    return f"{sign}{mag // 100:,}.{mag % 100:02d}"
