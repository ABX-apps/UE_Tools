#!/usr/bin/env node
import { loadConfig, type ArgFlags } from "./config.js";
import { fileGet, modulesList, search, status, tree } from "./source.js";
import { UeToolsError } from "./types.js";

const HELP = `ue-tools — search/read ABX-apps/UnrealEngine (default ref: release)

Usage:
  ue-tools [--fixture] [--ref <ref>] status
  ue-tools [--fixture] [--ref <ref>] search <query>
  ue-tools [--fixture] [--ref <ref>] file get <path>
  ue-tools [--fixture] [--ref <ref>] tree [path]
  ue-tools [--fixture] [--ref <ref>] modules list
  ue-tools mcp

Env:
  GITHUB_TOKEN or GH_TOKEN   required for live GitHub (repo scope on the private fork)
  UE_OWNER / UE_REPO / UE_REF
  UE_FIXTURE=1               dry mode (bundled fixture tree; no GitHub)

Private bot tooling. Not published to any marketplace.
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
  const [cmd, sub, ...rest] = positionals;

  let result: unknown;
  switch (cmd) {
    case "status":
      result = status(cfg);
      break;
    case "search": {
      const query = [sub, ...rest].filter(Boolean).join(" ");
      result = await search(query, cfg);
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
    default:
      throw new UeToolsError("usage", `Unknown command: ${cmd ?? ""}\n\n${HELP}`);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

function parseArgs(argv: string[]): { flags: ArgFlags; positionals: string[] } {
  const flags: ArgFlags = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--fixture") flags.fixture = true;
    else if (arg === "--ref") {
      const value = argv[++i];
      if (!value) throw new UeToolsError("usage", "--ref requires a value");
      flags.ref = value;
    } else if (arg.startsWith("--ref=")) flags.ref = arg.slice("--ref=".length);
    else if (arg.startsWith("-")) throw new UeToolsError("usage", `Unknown flag: ${arg}`);
    else positionals.push(arg);
  }
  return { flags, positionals };
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
