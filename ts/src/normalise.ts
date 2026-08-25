/** Reference normalisation: uppercase -> strip leading alpha prefix -> strip
 * non-alphanumerics -> strip leading zeros.  INV-88512 -> 88512 <- MER-88512. */

const LEADING_ALPHA = /^[A-Z]+[-_/ ]*/;
const NON_ALNUM = /[^A-Z0-9]/g;

export function normaliseRef(raw: string): string {
  let s = raw.trim().toUpperCase();
  s = s.replace(LEADING_ALPHA, "");
  s = s.replace(NON_ALNUM, "");
  s = s.replace(/^0+/, "");
  return s;
}

/** The prefix removed by normalisation, e.g. "MER-88512" -> "MER-". Empty if none. */
export function alphaPrefix(raw: string): string {
  const m = raw.trim().toUpperCase().match(LEADING_ALPHA);
  return m ? m[0] : "";
}
