import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config.js";
import { fileGet, modulesList, search, status, tree } from "./source.js";
import { UeToolsError } from "./types.js";

const TOOLS = [
  {
    name: "ue_status",
    description:
      "Show configured Unreal Engine fork coordinates (owner/repo/ref/source). Never returns secrets.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "ue_search",
    description:
      "GitHub code search scoped to ABX-apps/UnrealEngine (default indexed branch: release). Fixture mode searches the bundled tree.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Code search query (repo: is added automatically)." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "ue_file_get",
    description: "Read a UTF-8 file from the Unreal Engine fork at the configured ref (default release).",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repository-relative file path." },
        ref: { type: "string", description: "Git ref override (branch, tag, or SHA)." },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "ue_tree",
    description: "List a directory in the Unreal Engine fork at the configured ref.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repository-relative directory path. Empty for repo root." },
        ref: { type: "string", description: "Git ref override (branch, tag, or SHA)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "ue_modules_list",
    description:
      "Heuristic list of top-level Engine/Source/Runtime and Engine/Source/Editor module directories from tree. Not a UBT graph.",
    inputSchema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "Git ref override (branch, tag, or SHA)." },
      },
      additionalProperties: false,
    },
  },
] as const;

function textResult(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

function errorResult(err: unknown) {
  const message =
    err instanceof UeToolsError ? `${err.code}: ${err.message}` : err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export async function runMcpServer(): Promise<void> {
  const server = new Server({ name: "ue-source", version: "0.1.0" }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...TOOLS] }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    try {
      switch (name) {
        case "ue_status":
          return textResult(status(loadConfig()));
        case "ue_search":
          return textResult(await search(String(args.query ?? ""), loadConfig()));
        case "ue_file_get":
          return textResult(await fileGet(String(args.path ?? ""), loadConfig({ ref: optionalString(args.ref) })));
        case "ue_tree":
          return textResult(
            await tree(optionalString(args.path), loadConfig({ ref: optionalString(args.ref) })),
          );
        case "ue_modules_list":
          return textResult(await modulesList(loadConfig({ ref: optionalString(args.ref) })));
        default:
          return errorResult(new UeToolsError("unknown_tool", `Unknown tool: ${name}`));
      }
    } catch (err) {
      return errorResult(err);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

const isMain = process.argv[1]?.endsWith("mcp.js") || process.argv[1]?.endsWith("mcp.ts");
if (isMain) {
  runMcpServer().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`ue-source mcp failed: ${message}\n`);
    process.exit(1);
  });
}
