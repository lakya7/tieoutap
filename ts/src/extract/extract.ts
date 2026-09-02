/** Statement document -> StatementLine list, with the Phase 2 safety rails:
 *
 * - The statement's own printed closing balance must equal the sum of the
 *   extracted lines exactly, or extraction refuses to reconcile.
 * - Credit notes are normalised to negative regardless of presentation
 *   (bracketed, CR suffix, explicit minus sign).
 * - Balance-forward statements are rejected as unsupported.
 * - Every line carries page + bounding-box provenance.
 *
 * The model is only ever asked to transcribe; all arithmetic and all
 * decisions happen here, deterministically, in integer cents. */
import type { StatementLine } from "../models";
import { parseAmount } from "../money";
import { normaliseRef } from "../normalise";
import { validateExtraction } from "./schema";
import type {
  ExtractionResult, RawExtraction, SourceBox, StatementDocument, VisionClient,
} from "./types";

const CREDIT_DOC_TYPES = ["CRN", "CR", "CREDIT", "CREDIT NOTE", "CN"];

/** Parse an amount exactly as printed on a statement into signed integer
 * cents: "(2,760.00)" and "2,760.00 CR" and "2,760.00CR" and "-2,760.00"
 * all mean -276000. */
export function parsePrintedAmount(text: string): number {
  let s = text.trim();
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  const cr = s.match(/^(.*?)\s*CR$/i);
  if (cr) {
    negative = true;
    s = cr[1]!.trim();
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1).trim();
  }
  s = s.replace(/^[£$€]/, "").trim();
  const cents = parseAmount(s);
  return negative ? -cents : cents;
}

function refuse(
  reason: "balance_forward_unsupported" | "closing_balance_mismatch" | "invalid_model_output",
  detail: string,
): ExtractionResult {
  return { ok: false, reason, detail, confidence: "0.00" };
}

/** Deterministic conversion of a validated model payload into engine input.
 * Exposed separately so tests can drive it without any client. */
export function buildExtractionResult(raw: RawExtraction): ExtractionResult {
  if (raw.balance_forward) {
    return refuse(
      "balance_forward_unsupported",
      "statement carries a balance-forward line instead of itemising open " +
        "documents; reconciliation against it would be wrong",
    );
  }

  let statedBalance: number;
  try {
    statedBalance = parsePrintedAmount(raw.stated_closing_balance_text);
  } catch (e) {
    return refuse(
      "invalid_model_output",
      `unparseable stated closing balance: ${String(e)}`,
    );
  }

  const lines: StatementLine[] = [];
  const boxes: Record<string, SourceBox> = {};
  let total = 0;
  for (let i = 0; i < raw.lines.length; i++) {
    const line = raw.lines[i]!;
    let amount: number;
    try {
      amount = parsePrintedAmount(line.amount_text);
    } catch (e) {
      return refuse(
        "invalid_model_output",
        `unparseable amount on line ${i + 1} (${line.ref}): ${String(e)}`,
      );
    }
    const docType = line.doc_type.trim().toUpperCase();
    if (CREDIT_DOC_TYPES.includes(docType) && amount > 0) amount = -amount;
    const id = `S${i + 1}`;
    lines.push({
      id,
      raw_ref: line.ref.trim(),
      normalised_ref: normaliseRef(line.ref),
      doc_date: line.date,
      doc_type: docType,
      amount,
      currency: line.currency.trim().toUpperCase() || "USD",
      po_number: line.po.trim(),
    });
    boxes[id] = line.box;
    total += amount;
  }

  if (total !== statedBalance) {
    return refuse(
      "closing_balance_mismatch",
      `sum of extracted lines (${total} minor units) does not equal the ` +
        `statement's stated closing balance (${statedBalance} minor units); ` +
        "refusing to reconcile an unverified extraction",
    );
  }

  return {
    ok: true,
    supplier: raw.supplier.trim(),
    as_at: raw.as_at,
    stated_closing_balance: statedBalance,
    lines,
    boxes,
    confidence: "0.90",
  };
}

/** The single Phase 2 entry point: document in, verified StatementLine list
 * (or a refusal) out. */
export async function extractStatement(
  document: StatementDocument,
  client: VisionClient,
): Promise<ExtractionResult> {
  const payload = await client.extract(document);
  const validated = validateExtraction(payload);
  if (!validated.ok) {
    return refuse("invalid_model_output", validated.error);
  }
  return buildExtractionResult(validated.value);
}
