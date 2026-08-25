"""Reference normalisation: uppercase -> strip leading alpha prefix -> strip
non-alphanumerics -> strip leading zeros.  INV-88512 -> 88512 <- MER-88512."""
from __future__ import annotations

import re

_LEADING_ALPHA = re.compile(r"^[A-Z]+[\-_/ ]*")
_NON_ALNUM = re.compile(r"[^A-Z0-9]")


def normalise_ref(raw: str) -> str:
    s = raw.strip().upper()
    s = _LEADING_ALPHA.sub("", s)
    s = _NON_ALNUM.sub("", s)
    s = s.lstrip("0")
    return s


def alpha_prefix(raw: str) -> str:
    """The prefix removed by normalisation, e.g. 'MER-88512' -> 'MER-'. Empty if none."""
    m = _LEADING_ALPHA.match(raw.strip().upper())
    return m.group(0) if m else ""
