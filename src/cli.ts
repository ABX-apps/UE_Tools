#!/usr/bin/env node
import { loadConfig, loadEditorConfig, type ArgFlags } from "./config.js";
import {
  editorActorsList,
  editorConsole,
  editorHighResShot,
  editorObjectDescribe,
  editorObjectGet,
  editorObjectSet,
  editorScreenshot,
  editorSelect,
  editorStatus,
  parsePropertyValue,
} from "./editor.js";
import { fileGet, fileHistory, findSymbol, modulesList, search, status, tree } from "./source.js";
import { UeToolsError } from "./types.js";

const HELP = `ue-tools — unofficial Unreal Editor Remote Control + optional GitHub source search
Not affiliated with Epic Games.

Source (GitHub, default EpicGames/UnrealEngine ref: release):
  ue-tools [--fixture] [--ref <ref>] status
  ue-tools [--fixture] [--ref <ref>] search [--path <dir>] [--language <lang>] [--extension <ext>] <query>
  ue-tools [--fixture] [--ref <ref>] symbol <name>
  ue-tools [--fixture] [--ref <ref>] find-class <name>
  ue-tools [--fixture] [--ref <ref>] history [--limit <n>] <path>
  ue-tools [--fixture] [--ref <ref>] blame [--limit <n>] <path>
  ue-tools [--fixture] [--ref <ref>] file get <path>
  ue-tools [--fixture] [--ref <ref>] tree [path]
  ue-tools [--fixture] [--ref <ref>] modules list

Editor (Web Remote Control HTTP; enable Remote Control API, then WebControl.StartServer):
  ue-tools [--fixture] [--url <url>] editor status
  ue-tools [--fixture] [--url <url>] editor actors list [--name <substr>] [--class <substr>] [--limit <n>]
  ue-tools [--fixture] [--url <url>] editor select
  ue-tools [--fixture] [--url <url>] editor object describe <objectPath>
  ue-tools [--fixture] [--url <url>] editor object get <objectPath> [propertyName]
  ue-tools [--fixture] [--url <url>] editor object set <objectPath> <propertyName> <jsonValue> --confirm
  ue-tools [--fixture] [--url <url>] editor console <command>
  ue-tools [--fixture] [--url <url>] editor highresshot
  ue-tools [--fixture] [--url <url>] editor screenshot

  ue-tools mcp

Env / Marketplace Configure:
  GITHUB_TOKEN or GH_TOKEN     required for live GitHub source search
  UE_OWNER / UE_REPO / UE_REF  default EpicGames / UnrealEngine / release (override for a private fork)
  UE_REMOTE_CONTROL_URL        Web Remote Control HTTP base URL (default http://127.0.0.1:30010)
  UE_FIXTURE=1                 dry mode (bundled source tree + mock Remote Control HTTP)

Setup: enable Remote Control API → WebControl.StartServer (optional WebControl.EnableServerOnStartup).
Optional: allow remote console execution for editor console / highresshot.
If the Editor is on another host, set UE_REMOTE_CONTROL_URL (bind + firewall). Other Unreal
services (for example Zen) on other ports are not Remote Control. Down/wrong URL → editor_unreachable.
Mutating object set requires --confirm / confirm=true. editor screenshot documents a gap:
/remote/object/thumbnail is asset thumbs only; highresshot wraps console HighResShot.
`;

async function main(argv: string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) {
    process.stdout.write(HELP);
    return 0;
  }
  if (argv[0] === "mcp") {
    const { runMcpServer } = await import("./mcp.js");
    await runMcpServer();
    return 0;
  }

  const { flags, positionals } = parseArgs(argv);
  const cfg = loadConfig(flags);
  const editorCfg = loadEditorConfig(flags);
  const [cmd, sub, ...rest] = positionals;

  let result: unknown;
  switch (cmd) {
    case "status":
      result = status(cfg);
      break;
    case "search": {
      const query = [sub, ...rest].filter(Boolean).join(" ");
      result = await search(query, cfg, {
        path: flags.path,
        language: flags.language,
        extension: flags.extension,
      });
      break;
    }
    case "symbol":
    case "find-class": {
      const name = [sub, ...rest].filter(Boolean).join(" ");
      result = await findSymbol(name, cfg);
      break;
    }
    case "history":
    case "blame": {
      const filePath = [sub, ...rest].filter(Boolean).join(" ");
      result = await fileHistory(filePath, cfg, flags.limit ?? 10);
      break;
    }
    case "file":
      if (sub !== "get") throw new UeToolsError("usage", "Usage: ue-tools file get <path>");
      result = await fileGet(rest.join(" "), cfg);
      break;
    case "tree":
      result = await tree([sub, ...rest].filter(Boolean).join(" "), cfg);
      break;
    case "modules":
      if (sub !== "list") throw new UeToolsError("usage", "Usage: ue-tools modules list");
      result = await modulesList(cfg);
      break;
    case "editor":
      result = await runEditor(sub, rest, editorCfg, flags);
      break;
    default:
      throw new UeToolsError("usage", `Unknown command: ${cmd ?? ""}\n\n${HELP}`);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

async function runEditor(
  sub: string | undefined,
  rest: string[],
  editorCfg: ReturnType<typeof loadEditorConfig>,
  flags: ArgFlags,
) {
  switch (sub) {
    case "status":
      return editorStatus(editorCfg);
    case "actors":
      if (rest[0] !== "list") throw new UeToolsError("usage", "Usage: ue-tools editor actors list [--name <substr>] [--class <substr>] [--limit <n>]");
      return editorActorsList(editorCfg, { name: flags.name, class: flags.class, limit: flags.limit });
    case "select":
    case "selection":
      return editorSelect(editorCfg);
    case "object":
      return runEditorObject(rest, editorCfg, flags);
    case "console":
      return editorConsole(rest.join(" "), editorCfg);
    case "highresshot":
      return editorHighResShot(editorCfg);
    case "screenshot":
      return editorScreenshot(editorCfg);
    default:
      throw new UeToolsError(
        "usage",
        "Usage: ue-tools editor status | actors list | select | object describe|get|set | console <command> | highresshot | screenshot",
      );
  }
}

async function runEditorObject(
  rest: string[],
  editorCfg: ReturnType<typeof loadEditorConfig>,
  flags: ArgFlags,
) {
  const [op, objectPath, propertyName, ...valueParts] = rest;
  switch (op) {
    case "describe":
      return editorObjectDescribe([objectPath, propertyName, ...valueParts].filter(Boolean).join(" "), editorCfg);
    case "get":
      return editorObjectGet(objectPath ?? "", propertyName, editorCfg);
    case "set": {
      const rawValue = valueParts.join(" ");
      if (!objectPath || !propertyName || !rawValue) {
        throw new UeToolsError("usage", "Usage: ue-tools editor object set <objectPath> <propertyName> <jsonValue> --confirm");
      }
      return editorObjectSet(objectPath, propertyName, parsePropertyValue(rawValue), editorCfg, {
        confirm: flags.confirm,
        transaction: flags.transaction,
      });
    }
    default:
      throw new UeToolsError("usage", "Usage: ue-tools editor object describe|get|set ...");
  }
}

function parseArgs(argv: string[]): { flags: ArgFlags; positionals: string[] } {
  const flags: ArgFlags = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--fixture") flags.fixture = true;
    else if (arg === "--confirm") flags.confirm = true;
    else if (arg === "--no-transaction") flags.transaction = false;
    else if (arg === "--transaction") flags.transaction = true;
    else if (arg === "--ref") flags.ref = requireFlagValue(argv, ++i, "--ref");
    else if (arg.startsWith("--ref=")) flags.ref = arg.slice("--ref=".length);
    else if (arg === "--url") flags.url = requireFlagValue(argv, ++i, "--url");
    else if (arg.startsWith("--url=")) flags.url = arg.slice("--url=".length);
    else if (arg === "--path") flags.path = requireFlagValue(argv, ++i, "--path");
    else if (arg.startsWith("--path=")) flags.path = arg.slice("--path=".length);
    else if (arg === "--language") flags.language = requireFlagValue(argv, ++i, "--language");
    else if (arg.startsWith("--language=")) flags.language = arg.slice("--language=".length);
    else if (arg === "--extension") flags.extension = requireFlagValue(argv, ++i, "--extension");
    else if (arg.startsWith("--extension=")) flags.extension = arg.slice("--extension=".length);
    else if (arg === "--name") flags.name = requireFlagValue(argv, ++i, "--name");
    else if (arg.startsWith("--name=")) flags.name = arg.slice("--name=".length);
    else if (arg === "--class") flags.class = requireFlagValue(argv, ++i, "--class");
    else if (arg.startsWith("--class=")) flags.class = arg.slice("--class=".length);
    else if (arg === "--limit") flags.limit = parseLimit(requireFlagValue(argv, ++i, "--limit"));
    else if (arg.startsWith("--limit=")) flags.limit = parseLimit(arg.slice("--limit=".length));
    else if (arg.startsWith("-")) throw new UeToolsError("usage", `Unknown flag: ${arg}`);
    else positionals.push(arg);
  }
  return { flags, positionals };
}

function requireFlagValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value || value.startsWith("-")) throw new UeToolsError("usage", `${flag} requires a value`);
  return value;
}

function parseLimit(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) throw new UeToolsError("usage", "--limit must be a positive number");
  return Math.trunc(n);
}

function printError(err: unknown): void {
  if (err instanceof UeToolsError) {
    process.stderr.write(`error: ${err.code}: ${err.message}\n`);
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`error: ${message}\n`);
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    printError(err);
    process.exit(1);
  });
