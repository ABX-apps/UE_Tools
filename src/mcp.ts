import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig, loadEditorConfig } from "./config.js";
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
} from "./editor.js";
import { fileGet, fileHistory, findSymbol, modulesList, search, status, tree } from "./source.js";
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
      "GitHub code search scoped to the configured Unreal Engine repo (default EpicGames/UnrealEngine, indexed branch release). Optional path/language/extension filters. Hits include path, repo, and snippet. Fixture mode searches the bundled tree.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Code search query (repo: is added automatically)." },
        path: { type: "string", description: "Restrict to a repository path prefix (GitHub path: qualifier)." },
        language: { type: "string", description: "GitHub language qualifier, e.g. C++ or C#." },
        extension: { type: "string", description: "File extension without dot, e.g. h or cpp." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "ue_symbol",
    description:
      "Heuristic find-class: locate UCLASS / class FFoo / .h declarations for a type name via GitHub code search (no clone). Prefer headers.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Type or class name, e.g. FName, UEngine, AActor." },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "ue_history",
    description:
      "Lightweight file history: last N commits touching a path via the GitHub commits API. Not line-level blame; no clone.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repository-relative file path." },
        limit: { type: "number", description: "Max commits (1-100, default 10)." },
        ref: { type: "string", description: "Git ref override (branch, tag, or SHA)." },
      },
      required: ["path"],
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
      "Ping Unreal Editor Remote Control HTTP (GET /remote/info). Requires a running Editor on the user's machine with Remote Control enabled. Set UE_REMOTE_CONTROL_URL (default http://127.0.0.1:30010). Unofficial; not affiliated with Epic Games.",
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
      "List level actors via PUT /remote/object/call GetAllLevelActors (EditorActorSubsystem, then EditorLevelLibrary). Optional name/class filters and limit. Class filter uses PUT /remote/object/describe (or /remote/batch). Not /remote/search/actors (that route does not exist).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Case-insensitive substring filter on actor name or path." },
        class: { type: "string", description: "Case-insensitive substring filter on described Class (e.g. PlayerStart)." },
        limit: { type: "number", description: "Max actors to return." },
        url: { type: "string", description: "Remote Control base URL override." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "ue_editor_select",
    description:
      "Get current Editor actor selection via PUT /remote/object/call EditorActorSubsystem.GetSelectedLevelActors. Remote Control has no dedicated selection HTTP route.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Remote Control base URL override." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "ue_editor_object_describe",
    description:
      "Describe a UObject (name, class, properties metadata) via PUT /remote/object/describe.",
    inputSchema: {
      type: "object",
      properties: {
        objectPath: { type: "string", description: "UObject path, e.g. /Game/Map.Map:PersistentLevel.Actor." },
        url: { type: "string", description: "Remote Control base URL override." },
      },
      required: ["objectPath"],
      additionalProperties: false,
    },
  },
  {
    name: "ue_editor_object_get",
    description:
      "Read UObject properties via PUT /remote/object/property with READ_ACCESS. Omit propertyName to list all readable properties.",
    inputSchema: {
      type: "object",
      properties: {
        objectPath: { type: "string", description: "UObject path." },
        propertyName: { type: "string", description: "Optional single property name." },
        url: { type: "string", description: "Remote Control base URL override." },
      },
      required: ["objectPath"],
      additionalProperties: false,
    },
  },
  {
    name: "ue_editor_object_set",
    description:
      "Write a UObject property via PUT /remote/object/property (WRITE_TRANSACTION_ACCESS by default). Mutating; requires confirm=true.",
    inputSchema: {
      type: "object",
      properties: {
        objectPath: { type: "string", description: "UObject path." },
        propertyName: { type: "string", description: "Property to write." },
        propertyValue: { description: "New value (JSON). Wrapped as { propertyName: value } for Remote Control." },
        confirm: { type: "boolean", description: "Must be true to apply the write." },
        transaction: {
          type: "boolean",
          description: "Default true (WRITE_TRANSACTION_ACCESS, undoable). false uses WRITE_ACCESS.",
        },
        url: { type: "string", description: "Remote Control base URL override." },
      },
      required: ["objectPath", "propertyName", "propertyValue", "confirm"],
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
    name: "ue_editor_highresshot",
    description:
      "Helper that wraps editor console HighResShot. PNG is written on the Editor host (Saved/Screenshots); bytes are not returned over HTTP. Viewport capture remains a Remote Control gap (see ue_editor_screenshot).",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Remote Control base URL override." },
      },
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
  const server = new Server({ name: "ue-tools", version: "0.2.0" }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...TOOLS] }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    try {
      switch (name) {
        case "ue_status":
          return textResult(status(loadConfig()));
        case "ue_search":
          return textResult(
            await search(String(args.query ?? ""), loadConfig(), {
              path: optionalString(args.path),
              language: optionalString(args.language),
              extension: optionalString(args.extension),
            }),
          );
        case "ue_symbol":
          return textResult(await findSymbol(String(args.name ?? ""), loadConfig()));
        case "ue_history":
          return textResult(
            await fileHistory(
              String(args.path ?? ""),
              loadConfig({ ref: optionalString(args.ref) }),
              optionalNumber(args.limit) ?? 10,
            ),
          );
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
          return textResult(
            await editorActorsList(loadEditorConfig({ url: optionalString(args.url) }), {
              name: optionalString(args.name),
              class: optionalString(args.class),
              limit: optionalNumber(args.limit),
            }),
          );
        case "ue_editor_select":
          return textResult(await editorSelect(loadEditorConfig({ url: optionalString(args.url) })));
        case "ue_editor_object_describe":
          return textResult(
            await editorObjectDescribe(String(args.objectPath ?? ""), loadEditorConfig({ url: optionalString(args.url) })),
          );
        case "ue_editor_object_get":
          return textResult(
            await editorObjectGet(
              String(args.objectPath ?? ""),
              optionalString(args.propertyName),
              loadEditorConfig({ url: optionalString(args.url) }),
            ),
          );
        case "ue_editor_object_set":
          return textResult(
            await editorObjectSet(
              String(args.objectPath ?? ""),
              String(args.propertyName ?? ""),
              args.propertyValue,
              loadEditorConfig({ url: optionalString(args.url) }),
              {
                confirm: args.confirm === true,
                transaction: args.transaction === false ? false : true,
              },
            ),
          );
        case "ue_editor_console":
          return textResult(
            await editorConsole(String(args.command ?? ""), loadEditorConfig({ url: optionalString(args.url) })),
          );
        case "ue_editor_highresshot":
          return textResult(await editorHighResShot(loadEditorConfig({ url: optionalString(args.url) })));
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

function optionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

const isMain = process.argv[1]?.endsWith("mcp.js") || process.argv[1]?.endsWith("mcp.ts");
if (isMain) {
  runMcpServer().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`ue-tools mcp failed: ${message}\n`);
    process.exit(1);
  });
}
