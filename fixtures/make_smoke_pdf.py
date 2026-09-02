"""Generate fixtures/smoke_stmt.pdf — a tiny supplier statement used only by
the optional live extraction smoke test. Pure-stdlib, deterministic."""
import zlib
from pathlib import Path

LINES = [
    ("MERIDIAN IND SUPPLIES", 740, 14),
    ("STATEMENT OF ACCOUNT  AS AT 2026-07-31", 715, 11),
    ("REF        DATE        TYPE   PO        AMOUNT", 675, 10),
    ("MER-88512  2026-07-01  INV    PO-1001   1,234.00", 655, 10),
    ("CRN-2210   2026-07-10  CRN              (260.00)", 635, 10),
    ("MER-88600  2026-07-15  INV                500.00", 615, 10),
    ("CLOSING BALANCE                          1,474.00", 585, 11),
]


def esc(s: str) -> str:
    return s.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def main() -> None:
    parts = ["BT"]
    for text, y, size in LINES:
        parts.append(f"/F1 {size} Tf 72 {y} Td ({esc(text)}) Tj 0 0 Td")
        parts.append("ET BT")
    parts[-1] = "ET"
    stream = zlib.compress(" ".join(parts).encode("ascii"))

    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
        b"<< /Length %d /Filter /FlateDecode >>\nstream\n" % len(stream)
        + stream + b"\nendstream",
    ]

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += (
        b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n"
        % (len(objs) + 1, xref)
    )
    Path(__file__).with_name("smoke_stmt.pdf").write_bytes(bytes(out))


if __name__ == "__main__":
    main()
