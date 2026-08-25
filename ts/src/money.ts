/** Money parsing/formatting. Integer minor units only — no fractional
 * arithmetic ever touches money. */
import type { Cents } from "./models";

export function parseAmount(raw: string): Cents {
  let s = raw.trim().replace(/,/g, "");
  if (!s) throw new Error("empty amount");
  let sign = 1;
  if (s.startsWith("-")) {
    sign = -1;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  const dot = s.indexOf(".");
  const whole = dot === -1 ? s : s.slice(0, dot);
  const frac = dot === -1 ? "" : s.slice(dot + 1);
  const digits = /^[0-9]+$/;
  if (
    frac.length > 2 ||
    !digits.test(whole + frac) ||
    (whole && !digits.test(whole)) ||
    (frac && !digits.test(frac))
  ) {
    throw new Error(`bad amount: ${JSON.stringify(raw)}`);
  }
  const frac2 = frac.padEnd(2, "0");
  return sign * (parseInt(whole || "0", 10) * 100 + parseInt(frac2, 10));
}

/** Signed cents as a plain decimal string, e.g. -276000 -> "-2760.00". */
export function formatCents(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const mag = Math.abs(cents);
  const whole = Math.trunc(mag / 100);
  const frac = String(mag % 100).padStart(2, "0");
  return `${sign}${whole}.${frac}`;
}

/** With thousands separators for the human report, e.g. 5916500 -> "59,165.00". */
export function formatCentsGrouped(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const mag = Math.abs(cents);
  const whole = Math.trunc(mag / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = String(mag % 100).padStart(2, "0");
  return `${sign}${whole}.${frac}`;
}
