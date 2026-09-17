import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig, loadEditorConfig } from "./config.js";
import { editorActorsList, editorConsole, editorScreenshot, editorStatus } from "./editor.js";
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
  {
    name: "ue_editor_status",
    description:
      "Ping Unreal Editor Remote Control HTTP (GET /remote/info). Requires a running Editor with Remote Control enabled. Set UE_REMOTE_CONTROL_URL (default http://127.0.0.1:30010). Grok Bot Linux does not host the Editor.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Remote Control base URL override." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "ue_editor_actors_list",
    description:
      "List level actors via PUT /remote/object/call GetAllLevelActors (EditorActorSubsystem, then EditorLevelLibrary). Not /remote/search/actors (that route does not exist).",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Remote Control base URL override." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "ue_editor_console",
    description:
      "Run an Unreal console command via PUT /remote/object/call KismetSystemLibrary.ExecuteConsoleCommand. Requires Remote Control to allow remote console execution.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Console command, e.g. stat fps or HighResShot." },
        url: { type: "string", description: "Remote Control base URL override." },
      },
      required: ["command"],
      additionalProperties: false,
    },
  },
  {
    name: "ue_editor_screenshot",
    description:
      "Viewport screenshot gap: Remote Control HTTP has no capture route. Confirms Editor reachability then explains /remote/object/thumbnail (asset thumbs only) and HighResShot workaround.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Remote Control base URL override." },
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
  const server = new Server({ name: "ue-tools", version: "0.1.0" }, { capabilities: { tools: {} } });

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
        case "ue_editor_status":
          return textResult(await editorStatus(loadEditorConfig({ url: optionalString(args.url) })));
        case "ue_editor_actors_list":
          return textResult(await editorActorsList(loadEditorConfig({ url: optionalString(args.url) })));
        case "ue_editor_console":
          return textResult(
            await editorConsole(String(args.command ?? ""), loadEditorConfig({ url: optionalString(args.url) })),
          );
        case "ue_editor_screenshot":
          return textResult(await editorScreenshot(loadEditorConfig({ url: optionalString(args.url) })));
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
    process.stderr.write(`ue-tools mcp failed: ${message}\n`);
    process.exit(1);
  });
}
