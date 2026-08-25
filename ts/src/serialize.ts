/** Deterministic serialisation: JSON and the human-readable text report.
 *
 * The JSON output is byte-identical to the Python reference engine's
 * `json.dumps(to_dict(result), sort_keys=True, indent=2)`: recursively
 * sorted keys, two-space indent, ensure-ASCII string escaping, and money as
 * fixed-point strings. */
import { BUCKET_ORDER } from "./models";
import type {
  BridgeAdjustment, Finding, Match, ProposedRule, ReconcileResult,
} from "./models";
import { formatCents, formatCentsGrouped } from "./money";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** Escape a string exactly as Python's json.dumps does (ensure_ascii=True). */
function escapeString(s: string): string {
  let out = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (code < 0x20 || code > 0x7e) {
      if (code > 0xffff) {
        const high = 0xd800 + ((code - 0x10000) >> 10);
        const low = 0xdc00 + ((code - 0x10000) & 0x3ff);
        out += `\\u${high.toString(16).padStart(4, "0")}`;
        out += `\\u${low.toString(16).padStart(4, "0")}`;
      } else {
        out += `\\u${code.toString(16).padStart(4, "0")}`;
      }
    } else {
      out += ch;
    }
  }
  return out + '"';
}

/** json.dumps(value, sort_keys=True, indent=2) equivalent. */
export function stableStringify(value: Json, indentLevel = 0): string {
  const pad = "  ".repeat(indentLevel);
  const padInner = "  ".repeat(indentLevel + 1);
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new Error(`non-integer number: ${value}`);
    return String(value === 0 ? 0 : value);
  }
  if (typeof value === "string") return escapeString(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => padInner + stableStringify(v, indentLevel + 1));
    return "[\n" + items.join(",\n") + "\n" + pad + "]";
  }
  const keys = Object.keys(value).sort();
  if (keys.length === 0) return "{}";
  const items = keys.map(
    (k) => padInner + escapeString(k) + ": " + stableStringify(value[k]!, indentLevel + 1),
  );
  return "{\n" + items.join(",\n") + "\n" + pad + "}";
}

function plainMatch(m: Match): Json {
  return {
    statement_line_ids: m.statement_line_ids,
    ledger_line_ids: m.ledger_line_ids,
    method: m.method,
    confidence: m.confidence,
    amount_delta: formatCents(m.amount_delta),
    requires_human_confirmation: m.requires_human_confirmation,
  };
}

function plainFinding(f: Finding): Json {
  return {
    type: f.type,
    bucket: f.bucket,
    amount: formatCents(f.amount),
    statement_line_ids: f.statement_line_ids,
    ledger_line_ids: f.ledger_line_ids,
    rule_id: f.rule_id,
    evidence: f.evidence as Json,
  };
}

function plainRule(r: ProposedRule): Json {
  return {
    supplier: r.supplier,
    kind: r.kind,
    value: r.value,
    statement_line_ids: r.statement_line_ids,
    ledger_line_ids: r.ledger_line_ids,
  };
}

function plainAdjustment(a: BridgeAdjustment): Json {
  return {
    label: a.label,
    ref: a.ref,
    finding_type: a.finding_type,
    amount: formatCents(a.amount),
  };
}

export function toDict(result: ReconcileResult): Json {
  const b = result.bridge;
  return {
    supplier: result.supplier,
    as_at: result.as_at,
    bridge_ties_out: b.ties_out,
    diagnostic: result.diagnostic,
    warnings: result.warnings,
    matches: result.matches.map(plainMatch),
    findings: result.findings.map(plainFinding),
    proposed_rules: result.proposed_rules.map(plainRule),
    bridge: {
      ledger_open_total: formatCents(b.ledger_open_total),
      statement_total: formatCents(b.statement_total),
      ties_out: b.ties_out,
      adjustments: b.adjustments.map(plainAdjustment),
    },
  };
}

export function toJson(result: ReconcileResult): string {
  return stableStringify(toDict(result)) + "\n";
}

export function renderText(result: ReconcileResult): string {
  const out: string[] = [];
  out.push(`TieOut AP — ${result.supplier} as at ${result.as_at}`);
  out.push("");

  for (const w of result.warnings) out.push(`WARNING: ${w}`);
  if (result.warnings.length > 0) out.push("");

  if (result.diagnostic !== null) {
    out.push(`DIAGNOSTIC: ${result.diagnostic}`);
    out.push("");
  }

  if (result.findings.length > 0) {
    out.push("FINDINGS");
    for (const bucket of BUCKET_ORDER) {
      const inBucket = result.findings.filter((f) => f.bucket === bucket);
      if (inBucket.length === 0) continue;
      out.push(`  [${bucket}]`);
      for (const f of inBucket) {
        const ids = [...f.statement_line_ids, ...f.ledger_line_ids].join(",");
        out.push(
          `    ${f.type.padEnd(22)} ${formatCentsGrouped(f.amount).padStart(14)}  ` +
            `lines=${ids}  rule=${f.rule_id}`,
        );
      }
    }
    out.push("");
  }

  if (result.proposed_rules.length > 0) {
    out.push("PROPOSED NORMALISATION RULES");
    for (const r of result.proposed_rules) {
      out.push(`  ${r.supplier}: ${r.kind} '${r.value}'`);
    }
    out.push("");
  }

  out.push("BRIDGE");
  out.push(
    `  ${formatCentsGrouped(result.bridge.ledger_open_total).padStart(14)}  ledger open`,
  );
  for (const a of result.bridge.adjustments) {
    let signed = formatCentsGrouped(a.amount);
    if (a.amount >= 0) signed = "+" + signed;
    out.push(`  ${signed.padStart(14)}  ${a.ref}  ${a.label}`);
  }
  out.push("  " + "-".repeat(14));
  const tick = result.bridge.ties_out ? "OK ties out" : "DOES NOT TIE";
  out.push(
    `  ${formatCentsGrouped(result.bridge.statement_total).padStart(14)}  ` +
      `statement total  [${tick}]`,
  );
  return out.join("\n") + "\n";
}
