/** Anthropic vision adapter. Server-side only — requires an API key. The
 * model is forced into a single tool call whose input schema is
 * EXTRACTION_SCHEMA, at temperature 0. The engine and the rest of extraction
 * never import this module. */
import { EXTRACTION_SCHEMA, EXTRACTION_TOOL_NAME } from "./schema";
import type { StatementDocument, VisionClient } from "./types";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-5";

const SYSTEM_PROMPT = `You transcribe supplier account statements. Transcribe \
exactly what is printed — do not compute, correct, infer, or omit anything.

Rules:
- Record every transaction line on the statement, in the order printed.
- amount_text must be the amount exactly as printed, preserving brackets, \
CR suffixes, minus signs, and thousands separators. If the statement uses \
separate debit and credit columns, transcribe credit-column amounts with a \
" CR" suffix.
- stated_closing_balance_text is the statement's own printed closing/total \
balance, exactly as printed. Do not sum the lines yourself.
- Set balance_forward to true if the statement shows a balance-forward, \
brought-forward, or opening-balance line instead of itemising the open \
documents that make up the balance.
- box is the bounding box of the printed line as fractions of the page \
(0..1, origin top-left).
- Use empty strings for fields not printed on the statement.`;

export interface AnthropicClientOptions {
  apiKey: string;
  /** Required when the API key is identity-linked (console keys tied to a
   * user); the id of the workspace requests act in, e.g. "wrkspc_...". */
  workspaceId?: string;
  model?: string;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
}

interface AnthropicContentBlock {
  type: string;
  name?: string;
  input?: unknown;
}

/** VisionClient backed by the Anthropic Messages API. */
export function anthropicVisionClient(
  options: AnthropicClientOptions,
): VisionClient {
  const model = options.model ?? DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? 8192;
  const doFetch = options.fetchImpl ?? fetch;
  return {
    async extract(document: StatementDocument): Promise<unknown> {
      const source = {
        type: "base64",
        media_type: document.media_type,
        data: document.data,
      };
      const block =
        document.media_type === "application/pdf"
          ? { type: "document", source }
          : { type: "image", source };
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "x-api-key": options.apiKey,
        "anthropic-version": API_VERSION,
      };
      if (options.workspaceId) {
        headers["anthropic-workspace-id"] = options.workspaceId;
      }
      const response = await doFetch(API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: 0,
          system: SYSTEM_PROMPT,
          tools: [
            {
              name: EXTRACTION_TOOL_NAME,
              description:
                "Record the complete, exact transcription of the supplier " +
                "statement.",
              input_schema: EXTRACTION_SCHEMA,
            },
          ],
          tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
          messages: [
            {
              role: "user",
              content: [
                block,
                {
                  type: "text",
                  text:
                    "Transcribe this supplier statement using the " +
                    `${EXTRACTION_TOOL_NAME} tool.`,
                },
              ],
            },
          ],
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`anthropic API error ${response.status}: ${body}`);
      }
      const data = (await response.json()) as { content?: AnthropicContentBlock[] };
      const toolUse = (data.content ?? []).find(
        (b) => b.type === "tool_use" && b.name === EXTRACTION_TOOL_NAME,
      );
      if (!toolUse) throw new Error("anthropic response contained no tool call");
      return toolUse.input;
    },
  };
}
