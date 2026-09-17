import { loadEditorConfig, type EditorConfig } from "./config.js";
import { createFetchTransport, createFixtureTransport, type RcTransport } from "./remoteControl.js";
import {
  ACTOR_LIST_CANDIDATES,
  CONSOLE_CALL,
  UeToolsError,
  type EditorActorsResult,
  type EditorConsoleResult,
  type EditorScreenshotResult,
  type EditorStatusResult,
  type RcHttpRoute,
} from "./types.js";

export function createEditorTransport(cfg: EditorConfig): RcTransport {
  if (cfg.fixture) return createFixtureTransport();
  return createFetchTransport(cfg.remoteControlUrl, cfg.timeoutMs);
}

export async function editorStatus(cfg: EditorConfig = loadEditorConfig()): Promise<EditorStatusResult> {
  const transport = createEditorTransport(cfg);
  const { json } = await transport.request({ method: "GET", path: "/remote/info" });
  return {
    reachable: true,
    url: transport.baseUrl,
    source: cfg.fixture ? "fixture" : "remote-control",
    routes: parseRoutes(json),
  };
}

export async function editorActorsList(cfg: EditorConfig = loadEditorConfig()): Promise<EditorActorsResult> {
  const transport = createEditorTransport(cfg);
  let lastError: unknown;
  for (const candidate of ACTOR_LIST_CANDIDATES) {
    try {
      const { json } = await transport.request({
        method: "PUT",
        path: "/remote/object/call",
        body: { objectPath: candidate.objectPath, functionName: candidate.functionName },
      });
      return {
        url: transport.baseUrl,
        source: cfg.fixture ? "fixture" : "remote-control",
        via: { objectPath: candidate.objectPath, functionName: candidate.functionName },
        actors: parseActorPaths(json),
      };
    } catch (err) {
      lastError = err;
      if (err instanceof UeToolsError && err.code === "editor_unreachable") throw err;
    }
  }
  throw lastError instanceof UeToolsError
    ? lastError
    : new UeToolsError(
        "editor_error",
        "Could not list actors via EditorActorSubsystem or EditorLevelLibrary.GetAllLevelActors over PUT /remote/object/call.",
      );
}

export async function editorConsole(
  command: string,
  cfg: EditorConfig = loadEditorConfig(),
): Promise<EditorConsoleResult> {
  const cmd = command.trim();
  if (!cmd) throw new UeToolsError("usage", "Usage: ue-tools editor console <command>");
  const transport = createEditorTransport(cfg);
  const { json } = await transport.request({
    method: "PUT",
    path: "/remote/object/call",
    body: {
      objectPath: CONSOLE_CALL.objectPath,
      functionName: CONSOLE_CALL.functionName,
      parameters: { Command: cmd },
    },
  });
  return {
    url: transport.baseUrl,
    source: cfg.fixture ? "fixture" : "remote-control",
    command: cmd,
    via: { ...CONSOLE_CALL },
    result: json,
  };
}

export async function editorScreenshot(
  cfg: EditorConfig = loadEditorConfig(),
): Promise<EditorScreenshotResult> {
  const status = await editorStatus(cfg);
  return {
    available: false,
    imageReturned: false,
    url: status.url,
    source: status.source,
    reason:
      "Remote Control HTTP has no viewport-capture route. PUT /remote/object/thumbnail returns Content Browser asset thumbnails only.",
    thumbnailRoute: "/remote/object/thumbnail",
    workaround:
      "Run `ue-tools editor console HighResShot` on a reachable Editor; the PNG is written on that host under Saved/Screenshots and is not returned over HTTP.",
  };
}

function parseRoutes(json: unknown): RcHttpRoute[] {
  const routes =
    json && typeof json === "object" && "HttpRoutes" in json && Array.isArray((json as { HttpRoutes: unknown }).HttpRoutes)
      ? (json as { HttpRoutes: Array<Record<string, unknown>> }).HttpRoutes
      : [];
  return routes.map((route) => ({
    path: String(route.Path ?? route.path ?? ""),
    verb: String(route.Verb ?? route.verb ?? ""),
    description: route.Description || route.description ? String(route.Description ?? route.description) : undefined,
  }));
}

function parseActorPaths(json: unknown): EditorActorsResult["actors"] {
  const raw =
    json && typeof json === "object" && "ReturnValue" in json
      ? (json as { ReturnValue: unknown }).ReturnValue
      : json;
  const paths = Array.isArray(raw) ? raw : [];
  return paths
    .filter((path): path is string => typeof path === "string" && path.length > 0)
    .map((path) => ({ path, name: path.split(".").pop() || path }));
}
