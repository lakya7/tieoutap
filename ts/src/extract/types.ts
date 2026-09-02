/** Phase 2 extraction: statement document -> the same StatementLine list the
 * engine consumes, plus provenance and safety-rail outcomes. The engine never
 * depends on any of this; extraction is a separate, optional front door. */
import type { Cents, StatementLine } from "../models";

/** A statement document to extract: base64 data plus its media type. */
export interface StatementDocument {
  media_type:
    | "application/pdf"
    | "image/png"
    | "image/jpeg"
    | "image/gif"
    | "image/webp";
  /** Base64-encoded document bytes. */
  data: string;
}

/** Where a line was found in the source document. Coordinates are fractions
 * of the page (0..1, origin top-left), as reported by the model. */
export interface SourceBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One raw line as reported by the vision model, before validation. */
export interface RawExtractedLine {
  ref: string;
  date: string;
  doc_type: string;
  /** Amount exactly as printed, e.g. "(2,760.00)", "1,234.00 CR", "-500.00". */
  amount_text: string;
  po: string;
  currency: string;
  box: SourceBox;
}

/** The strict payload the model must return (via forced tool use). */
export interface RawExtraction {
  supplier: string;
  as_at: string;
  /** The statement's own printed closing balance, exactly as printed. */
  stated_closing_balance_text: string;
  /** True if the statement carries a balance-forward / brought-forward line
   * instead of itemising all open documents. */
  balance_forward: boolean;
  lines: RawExtractedLine[];
}

export type ExtractionRefusalReason =
  | "balance_forward_unsupported"
  | "closing_balance_mismatch"
  | "invalid_model_output";

export interface ExtractionRefusal {
  ok: false;
  reason: ExtractionRefusalReason;
  detail: string;
  confidence: "0.00";
}

export interface ExtractionSuccess {
  ok: true;
  supplier: string;
  as_at: string;
  stated_closing_balance: Cents;
  lines: StatementLine[];
  /** Provenance per line id (S1, S2, ...). */
  boxes: Record<string, SourceBox>;
  confidence: "0.90";
}

export type ExtractionResult = ExtractionSuccess | ExtractionRefusal;

/** Minimal vision-model client interface, injected so extraction is fully
 * testable without any model call. */
export interface VisionClient {
  /** Send the document + instructions; must return the tool-use input JSON
   * produced by the model (already parsed, unknown shape until validated). */
  extract(document: StatementDocument): Promise<unknown>;
}
