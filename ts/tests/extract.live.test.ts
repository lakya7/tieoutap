/** Live Anthropic smoke test. Opt-in only: set TIEOUT_LIVE_EXTRACTION=1 (and
 * ANTHROPIC_API_KEY) to run it — CI and normal test runs never call the
 * model. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { anthropicVisionClient } from "../src/extract/anthropic";
import { extractStatement } from "../src/extract/extract";

const apiKey = process.env["ANTHROPIC_API_KEY"];
const optIn = process.env["TIEOUT_LIVE_EXTRACTION"] === "1";

describe.skipIf(!apiKey || !optIn)("live extraction smoke test", () => {
  it("extracts fixtures/smoke_stmt.pdf and ties to the printed balance", async () => {
    const pdf = readFileSync(
      join(__dirname, "..", "..", "fixtures", "smoke_stmt.pdf"),
    );
    const client = anthropicVisionClient({
      apiKey: apiKey!,
      workspaceId: process.env["ANTHROPIC_WORKSPACE_ID"],
    });
    const result = await extractStatement(
      { media_type: "application/pdf", data: pdf.toString("base64") },
      client,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.as_at).toBe("2026-07-31");
    expect(result.stated_closing_balance).toBe(147400);
    expect(result.lines).toHaveLength(3);
    const amounts = result.lines.map((l) => l.amount);
    expect(amounts).toEqual([123400, -26000, 50000]);
    for (const line of result.lines) {
      expect(result.boxes[line.id]?.page).toBe(1);
    }
  }, 120_000);
});
