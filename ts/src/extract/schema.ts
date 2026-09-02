/** The strict JSON schema the model is forced to fill via tool use, and a
 * validator for it. Validation is deliberately strict: any deviation refuses
 * extraction rather than guessing. */
import type { RawExtractedLine, RawExtraction, SourceBox } from "./types";

export const EXTRACTION_TOOL_NAME = "record_statement_extraction";

export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "supplier", "as_at", "stated_closing_balance_text", "balance_forward",
    "lines",
  ],
  properties: {
    supplier: { type: "string", description: "Supplier name as printed" },
    as_at: {
      type: "string",
      pattern: "^\\d{4}-\\d{2}-\\d{2}$",
      description: "Statement date, ISO YYYY-MM-DD",
    },
    stated_closing_balance_text: {
      type: "string",
      description:
        "The statement's own printed closing/total balance, exactly as printed",
    },
    balance_forward: {
      type: "boolean",
      description:
        "true if the statement shows a balance-forward/brought-forward line " +
        "instead of itemising all open documents",
    },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref", "date", "doc_type", "amount_text", "po", "currency", "box"],
        properties: {
          ref: { type: "string", description: "Document reference as printed" },
          date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          doc_type: {
            type: "string",
            description: "Document type as printed, e.g. INV, CRN, PAY",
          },
          amount_text: {
            type: "string",
            description:
              "Amount exactly as printed, preserving brackets, CR suffix, " +
              "or sign, e.g. '(2,760.00)', '1,234.00 CR', '-500.00'",
          },
          po: { type: "string", description: "PO number if printed, else empty" },
          currency: {
            type: "string",
            description: "ISO currency code if printed, else empty",
          },
          box: {
            type: "object",
            additionalProperties: false,
            required: ["page", "x", "y", "width", "height"],
            properties: {
              page: { type: "integer", minimum: 1 },
              x: { type: "number", minimum: 0, maximum: 1 },
              y: { type: "number", minimum: 0, maximum: 1 },
              width: { type: "number", minimum: 0, maximum: 1 },
              height: { type: "number", minimum: 0, maximum: 1 },
            },
          },
        },
      },
    },
  },
} as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validBox(v: unknown): v is SourceBox {
  if (!isRecord(v)) return false;
  const { page, x, y, width, height } = v;
  return (
    typeof page === "number" && Number.isInteger(page) && page >= 1 &&
    [x, y, width, height].every(
      (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1,
    )
  );
}

function validLine(v: unknown): v is RawExtractedLine {
  if (!isRecord(v)) return false;
  return (
    typeof v["ref"] === "string" &&
    typeof v["date"] === "string" && ISO_DATE.test(v["date"]) &&
    typeof v["doc_type"] === "string" &&
    typeof v["amount_text"] === "string" &&
    typeof v["po"] === "string" &&
    typeof v["currency"] === "string" &&
    validBox(v["box"])
  );
}

/** Validate the model's tool input. Returns the typed payload or an error
 * message describing the first violation. */
export function validateExtraction(
  v: unknown,
): { ok: true; value: RawExtraction } | { ok: false; error: string } {
  if (!isRecord(v)) return { ok: false, error: "payload is not an object" };
  if (typeof v["supplier"] !== "string" || v["supplier"] === "") {
    return { ok: false, error: "supplier missing" };
  }
  if (typeof v["as_at"] !== "string" || !ISO_DATE.test(v["as_at"])) {
    return { ok: false, error: "as_at missing or not ISO YYYY-MM-DD" };
  }
  if (typeof v["stated_closing_balance_text"] !== "string" ||
      v["stated_closing_balance_text"] === "") {
    return { ok: false, error: "stated_closing_balance_text missing" };
  }
  if (typeof v["balance_forward"] !== "boolean") {
    return { ok: false, error: "balance_forward missing" };
  }
  const lines = v["lines"];
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, error: "lines missing or empty" };
  }
  for (let i = 0; i < lines.length; i++) {
    if (!validLine(lines[i])) return { ok: false, error: `lines[${i}] invalid` };
  }
  return { ok: true, value: v as unknown as RawExtraction };
}
