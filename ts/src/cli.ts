/** tieout reconcile — thin Node wrapper around the browser-first engine.
 * Only this file touches the filesystem; the engine itself is pure. */
import { readFileSync } from "node:fs";

import { DEFAULT_CONFIG, reconcile } from "./engine";
import { loadLedgerCsv, loadStatementCsv } from "./loader";
import { renderText, toJson } from "./serialize";

function parseArgs(argv: string[]): Map<string, string | boolean> {
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--json") args.set("json", true);
    else if (a.startsWith("--")) args.set(a.slice(2), argv[++i] ?? "");
    else args.set("command", a);
  }
  return args;
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.get("command") !== "reconcile") {
    process.stderr.write("usage: tieout reconcile --statement F --ledger F --supplier S --as-at D [--ledger-as-at D] [--json]\n");
    return 2;
  }
  const statement = loadStatementCsv(readFileSync(String(args.get("statement")), "utf-8"));
  const ledger = loadLedgerCsv(readFileSync(String(args.get("ledger")), "utf-8"));
  const result = reconcile(
    statement,
    ledger,
    String(args.get("supplier")),
    String(args.get("as-at")),
    DEFAULT_CONFIG,
    args.has("ledger-as-at") ? String(args.get("ledger-as-at")) : null,
  );
  process.stdout.write(args.get("json") ? toJson(result) : renderText(result));
  return result.bridge.ties_out ? 0 : 1;
}

if (process.argv[1] && process.argv[1].endsWith("cli.ts")) {
  process.exit(main(process.argv.slice(2)));
}
