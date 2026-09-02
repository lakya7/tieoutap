import { describe, expect, it } from "vitest";
import { reconcile } from "../src/engine";
import { anthropicVisionClient } from "../src/extract/anthropic";
import {
  buildExtractionResult, extractStatement, parsePrintedAmount,
} from "../src/extract/extract";
import { validateExtraction } from "../src/extract/schema";
import type {
  RawExtraction, StatementDocument, VisionClient,
} from "../src/extract/types";

const DOC: StatementDocument = { media_type: "application/pdf", data: "aGk=" };

function box(page = 1, y = 0.1) {
  return { page, x: 0.05, y, width: 0.9, height: 0.02 };
}

function goodPayload(): RawExtraction {
  return {
    supplier: "MERIDIAN IND SUPPLIES",
    as_at: "2026-07-31",
    stated_closing_balance_text: "1,474.00",
    balance_forward: false,
    lines: [
      {
        ref: "MER-88512", date: "2026-07-01", doc_type: "INV",
        amount_text: "1,234.00", po: "PO-1001", currency: "USD", box: box(1, 0.2),
      },
      {
        ref: "CRN-2210", date: "2026-07-10", doc_type: "CRN",
        amount_text: "(260.00)", po: "", currency: "", box: box(1, 0.3),
      },
      {
        ref: "MER-88600", date: "2026-07-15", doc_type: "INV",
        amount_text: "500.00", po: "", currency: "usd", box: box(2, 0.1),
      },
    ],
  };
}

function clientReturning(payload: unknown): VisionClient {
  return { extract: async () => payload };
}

describe("parsePrintedAmount", () => {
  it("normalises every credit presentation to negative", () => {
    expect(parsePrintedAmount("(2,760.00)")).toBe(-276000);
    expect(parsePrintedAmount("2,760.00 CR")).toBe(-276000);
    expect(parsePrintedAmount("2,760.00CR")).toBe(-276000);
    expect(parsePrintedAmount("2,760.00 cr")).toBe(-276000);
    expect(parsePrintedAmount("-2,760.00")).toBe(-276000);
    expect(parsePrintedAmount("( 2,760.00 )")).toBe(-276000);
  });
  it("parses plain and signed amounts as integer cents", () => {
    expect(parsePrintedAmount("59,165.00")).toBe(5916500);
    expect(parsePrintedAmount("$1,234.56")).toBe(123456);
    expect(parsePrintedAmount("0.01")).toBe(1);
  });
  it("rejects garbage", () => {
    expect(() => parsePrintedAmount("N/A")).toThrow();
    expect(() => parsePrintedAmount("")).toThrow();
  });
});

describe("schema validation", () => {
  it("accepts a well-formed payload", () => {
    expect(validateExtraction(goodPayload()).ok).toBe(true);
  });
  it("rejects non-objects, missing fields, and bad lines", () => {
    expect(validateExtraction(null).ok).toBe(false);
    expect(validateExtraction("x").ok).toBe(false);
    expect(validateExtraction({}).ok).toBe(false);
    const noBalance = { ...goodPayload(), stated_closing_balance_text: "" };
    expect(validateExtraction(noBalance).ok).toBe(false);
    const badDate = goodPayload();
    badDate.lines[0]!.date = "01/07/2026";
    expect(validateExtraction(badDate).ok).toBe(false);
    const badBox = goodPayload();
    (badBox.lines[0]!.box as { page: number }).page = 0;
    expect(validateExtraction(badBox).ok).toBe(false);
    const emptyLines = { ...goodPayload(), lines: [] };
    expect(validateExtraction(emptyLines).ok).toBe(false);
  });
});

describe("buildExtractionResult", () => {
  it("converts a verified payload into engine-ready StatementLines", () => {
    const result = buildExtractionResult(goodPayload());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.supplier).toBe("MERIDIAN IND SUPPLIES");
    expect(result.as_at).toBe("2026-07-31");
    expect(result.stated_closing_balance).toBe(147400);
    expect(result.confidence).toBe("0.90");
    expect(result.lines.map((l) => l.id)).toEqual(["S1", "S2", "S3"]);
    expect(result.lines.map((l) => l.amount)).toEqual([123400, -26000, 50000]);
    expect(result.lines[0]!.normalised_ref).toBe("88512");
    expect(result.lines[1]!.doc_type).toBe("CRN");
    expect(result.lines[2]!.currency).toBe("USD");
    expect(result.boxes["S3"]).toEqual(box(2, 0.1));
  });

  it("forces credit-note doc types negative even when printed positive", () => {
    const payload = goodPayload();
    payload.lines[1]!.amount_text = "260.00"; // printed without any credit marker
    const result = buildExtractionResult(payload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines[1]!.amount).toBe(-26000);
  });

  it("refuses on closing-balance mismatch with zero confidence", () => {
    const payload = goodPayload();
    payload.stated_closing_balance_text = "9,999.99";
    const result = buildExtractionResult(payload);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("closing_balance_mismatch");
    expect(result.confidence).toBe("0.00");
    expect(result.detail).toContain("refusing to reconcile");
  });

  it("rejects balance-forward statements as unsupported", () => {
    const payload = { ...goodPayload(), balance_forward: true };
    const result = buildExtractionResult(payload);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("balance_forward_unsupported");
  });

  it("refuses on unparseable amounts instead of guessing", () => {
    const payload = goodPayload();
    payload.lines[2]!.amount_text = "five hundred";
    const result = buildExtractionResult(payload);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid_model_output");
    expect(result.detail).toContain("MER-88600");
  });

  it("is deterministic: identical payloads give identical results", () => {
    const a = JSON.stringify(buildExtractionResult(goodPayload()));
    const b = JSON.stringify(buildExtractionResult(goodPayload()));
    expect(a).toBe(b);
  });
});

describe("extractStatement (mocked client — no model call)", () => {
  it("returns verified lines for a valid model response", async () => {
    const result = await extractStatement(DOC, clientReturning(goodPayload()));
    expect(result.ok).toBe(true);
  });

  it("refuses malformed model output", async () => {
    const result = await extractStatement(DOC, clientReturning({ junk: 1 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid_model_output");
  });

  it("extracted lines feed the engine directly", async () => {
    const result = await extractStatement(DOC, clientReturning(goodPayload()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const run = reconcile(result.lines, [], result.supplier, result.as_at);
    expect(run.bridge.statement_total).toBe(147400);
    expect(run.bridge.ties_out).toBe(true);
  });
});

describe("anthropic adapter (mocked fetch — no network)", () => {
  it("forces tool use at temperature 0 and returns the tool input", async () => {
    let captured: unknown;
    const fetchImpl = (async (_url: unknown, init?: { body?: unknown }) => {
      captured = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          content: [
            { type: "text", text: "ok" },
            {
              type: "tool_use", name: "record_statement_extraction",
              input: goodPayload(),
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const client = anthropicVisionClient({ apiKey: "test-key", fetchImpl });
    const payload = await client.extract(DOC);
    expect(validateExtraction(payload).ok).toBe(true);
    const req = captured as {
      temperature: number;
      tool_choice: { type: string; name: string };
      messages: { content: { type: string }[] }[];
    };
    expect(req.temperature).toBe(0);
    expect(req.tool_choice).toEqual({
      type: "tool", name: "record_statement_extraction",
    });
    expect(req.messages[0]!.content[0]!.type).toBe("document");
  });

  it("throws on API errors and missing tool calls", async () => {
    const err = (async () => new Response("nope", { status: 401 })) as typeof fetch;
    await expect(
      anthropicVisionClient({ apiKey: "k", fetchImpl: err }).extract(DOC),
    ).rejects.toThrow("401");
    const noTool = (async () =>
      new Response(JSON.stringify({ content: [{ type: "text", text: "hi" }] }), {
        status: 200,
      })) as typeof fetch;
    await expect(
      anthropicVisionClient({ apiKey: "k", fetchImpl: noTool }).extract(DOC),
    ).rejects.toThrow("no tool call");
  });
});
