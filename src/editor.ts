import { loadEditorConfig, requireConfirm, type EditorConfig } from "./config.js";
import { createFetchTransport, createFixtureTransport, type RcTransport } from "./remoteControl.js";
import {
  ACTOR_LIST_CANDIDATES,
  ACTOR_SELECT_CANDIDATES,
  CONSOLE_CALL,
  UeToolsError,
  type EditorActor,
  type EditorActorsResult,
  type EditorConsoleResult,
  type EditorHighResShotResult,
  type EditorObjectDescribeResult,
  type EditorObjectGetResult,
  type EditorObjectSetResult,
  type EditorScreenshotResult,
  type EditorSelectResult,
  type EditorStatusResult,
  type RcHttpRoute,
} from "./types.js";

export type ActorListOptions = {
  name?: string;
  class?: string;
  limit?: number;
};

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

export async function editorActorsList(
  cfg: EditorConfig = loadEditorConfig(),
  options: ActorListOptions = {},
): Promise<EditorActorsResult> {
  const transport = createEditorTransport(cfg);
  const listed = await callFirst(transport, ACTOR_LIST_CANDIDATES, "Could not list actors via EditorActorSubsystem or EditorLevelLibrary.GetAllLevelActors over PUT /remote/object/call.");
  let actors = parseActorPaths(listed.json);
  const nameFilter = options.name?.trim();
  const classFilter = options.class?.trim();
  if (nameFilter) {
    const needle = nameFilter.toLowerCase();
    actors = actors.filter(
      (actor) => actor.name.toLowerCase().includes(needle) || actor.path.toLowerCase().includes(needle),
    );
  }
  if (classFilter) {
    actors = await attachClasses(transport, actors);
    const needle = classFilter.toLowerCase();
    actors = actors.filter((actor) => (actor.class ?? "").toLowerCase().includes(needle));
  }
  const limit = normalizeLimit(options.limit);
  const truncated = limit !== undefined && actors.length > limit;
  if (limit !== undefined) actors = actors.slice(0, limit);
  return {
    url: transport.baseUrl,
    source: cfg.fixture ? "fixture" : "remote-control",
    via: listed.via,
    filter: nameFilter || classFilter ? { name: nameFilter, class: classFilter } : undefined,
    limit,
    truncated,
    actors,
  };
}

export async function editorSelect(cfg: EditorConfig = loadEditorConfig()): Promise<EditorSelectResult> {
  const transport = createEditorTransport(cfg);
  const listed = await callFirst(
    transport,
    ACTOR_SELECT_CANDIDATES,
    "Could not get Editor selection via EditorActorSubsystem.GetSelectedLevelActors (PUT /remote/object/call). There is no /remote/search/actors or dedicated selection HTTP route.",
  );
  return {
    url: transport.baseUrl,
    source: cfg.fixture ? "fixture" : "remote-control",
    via: listed.via,
    note: "Selection is EditorActorSubsystem.GetSelectedLevelActors over PUT /remote/object/call. Remote Control does not register a dedicated selection route.",
    actors: parseActorPaths(listed.json),
  };
}

export async function editorObjectDescribe(
  objectPath: string,
  cfg: EditorConfig = loadEditorConfig(),
): Promise<EditorObjectDescribeResult> {
  const path = requireObjectPath(objectPath);
  const transport = createEditorTransport(cfg);
  const { json } = await transport.request({
    method: "PUT",
    path: "/remote/object/describe",
    body: { objectPath: path },
  });
  return {
    url: transport.baseUrl,
    source: cfg.fixture ? "fixture" : "remote-control",
    objectPath: path,
    via: { method: "PUT", path: "/remote/object/describe" },
    describe: json,
  };
}

export async function editorObjectGet(
  objectPath: string,
  propertyName: string | undefined,
  cfg: EditorConfig = loadEditorConfig(),
): Promise<EditorObjectGetResult> {
  const path = requireObjectPath(objectPath);
  const transport = createEditorTransport(cfg);
  const body: Record<string, unknown> = { objectPath: path, access: "READ_ACCESS" };
  const prop = propertyName?.trim();
  if (prop) body.propertyName = prop;
  const { json } = await transport.request({
    method: "PUT",
    path: "/remote/object/property",
    body,
  });
  return {
    url: transport.baseUrl,
    source: cfg.fixture ? "fixture" : "remote-control",
    objectPath: path,
    propertyName: prop,
    access: "READ_ACCESS",
    via: { method: "PUT", path: "/remote/object/property" },
    properties: json,
  };
}

export async function editorObjectSet(
  objectPath: string,
  propertyName: string,
  propertyValue: unknown,
  cfg: EditorConfig = loadEditorConfig(),
  options: { confirm?: boolean; transaction?: boolean } = {},
): Promise<EditorObjectSetResult> {
  requireConfirm(options.confirm, "editor object set");
  const path = requireObjectPath(objectPath);
  const prop = propertyName.trim();
  if (!prop) throw new UeToolsError("usage", "editor object set requires a property name.");
  const access = options.transaction === false ? "WRITE_ACCESS" : "WRITE_TRANSACTION_ACCESS";
  const wrapped = wrapPropertyValue(prop, propertyValue);
  const transport = createEditorTransport(cfg);
  const { json } = await transport.request({
    method: "PUT",
    path: "/remote/object/property",
    body: {
      objectPath: path,
      propertyName: prop,
      access,
      propertyValue: wrapped,
    },
  });
  return {
    url: transport.baseUrl,
    source: cfg.fixture ? "fixture" : "remote-control",
    objectPath: path,
    propertyName: prop,
    access,
    via: { method: "PUT", path: "/remote/object/property" },
    result: json,
  };
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

export async function editorHighResShot(
  cfg: EditorConfig = loadEditorConfig(),
): Promise<EditorHighResShotResult> {
  const result = await editorConsole("HighResShot", cfg);
  return {
    ...result,
    imageReturned: false,
    note: "HighResShot writes a PNG on the Editor host (Saved/Screenshots). Remote Control HTTP does not return viewport bytes; see editor screenshot for the documented gap.",
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
      "Run `ue-tools editor highresshot` (wraps `editor console HighResShot`) on a reachable Editor; the PNG is written on that host under Saved/Screenshots and is not returned over HTTP.",
  };
}

export function wrapPropertyValue(propertyName: string, value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value) && propertyName in (value as object)) {
    return value as Record<string, unknown>;
  }
  return { [propertyName]: value };
}

export function parsePropertyValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed !== "" && Number.isFinite(Number(trimmed))) return Number(trimmed);
    return trimmed;
  }
}

function requireObjectPath(objectPath: string): string {
  const path = objectPath.trim();
  if (!path) throw new UeToolsError("usage", "objectPath is required (UObject path, e.g. /Game/Map.Map:PersistentLevel.Actor).");
  return path;
}

async function callFirst(
  transport: RcTransport,
  candidates: ReadonlyArray<{ objectPath: string; functionName: string }>,
  failure: string,
): Promise<{ json: unknown; via: { objectPath: string; functionName: string } }> {
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const { json } = await transport.request({
        method: "PUT",
        path: "/remote/object/call",
        body: { objectPath: candidate.objectPath, functionName: candidate.functionName },
      });
      return { json, via: { objectPath: candidate.objectPath, functionName: candidate.functionName } };
    } catch (err) {
      lastError = err;
      if (err instanceof UeToolsError && err.code === "editor_unreachable") throw err;
    }
  }
  throw lastError instanceof UeToolsError
    ? lastError
    : new UeToolsError("editor_error", failure);
}

async function attachClasses(transport: RcTransport, actors: EditorActor[]): Promise<EditorActor[]> {
  if (actors.length === 0) return actors;
  const requests = actors.map((actor, index) => ({
    RequestId: index + 1,
    URL: "/remote/object/describe",
    Verb: "PUT",
    Body: { objectPath: actor.path },
  }));
  try {
    const { json } = await transport.request({
      method: "PUT",
      path: "/remote/batch",
      body: { Requests: requests },
    });
    const responses = parseBatchResponses(json);
    return actors.map((actor, index) => {
      const described = responses.get(index + 1);
      const className = described ? classFromDescribe(described) : undefined;
      return className ? { ...actor, class: className } : actor;
    });
  } catch (err) {
    if (err instanceof UeToolsError && err.code === "editor_unreachable") throw err;
    const described = await Promise.all(
      actors.map(async (actor) => {
        try {
          const { json } = await transport.request({
            method: "PUT",
            path: "/remote/object/describe",
            body: { objectPath: actor.path },
          });
          const className = classFromDescribe(json);
          return className ? { ...actor, class: className } : actor;
        } catch {
          return actor;
        }
      }),
    );
    return described;
  }
}

function parseBatchResponses(json: unknown): Map<number, unknown> {
  const rec = json && typeof json === "object" ? (json as { Responses?: unknown }) : {};
  const rows = Array.isArray(rec.Responses) ? rec.Responses : [];
  const map = new Map<number, unknown>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as { RequestId?: unknown; ResponseBody?: unknown; ResponseCode?: unknown };
    const id = typeof item.RequestId === "number" ? item.RequestId : Number(item.RequestId);
    if (!Number.isFinite(id)) continue;
    if (item.ResponseCode && Number(item.ResponseCode) >= 400) continue;
    map.set(id, item.ResponseBody);
  }
  return map;
}

function classFromDescribe(json: unknown): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const rec = json as { Class?: unknown; class?: unknown };
  const value = rec.Class ?? rec.class;
  return typeof value === "string" && value ? value : undefined;
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

function parseActorPaths(json: unknown): EditorActor[] {
  const raw =
    json && typeof json === "object" && "ReturnValue" in json
      ? (json as { ReturnValue: unknown }).ReturnValue
      : json;
  const paths = Array.isArray(raw) ? raw : [];
  return paths
    .filter((path): path is string => typeof path === "string" && path.length > 0)
    .map((path) => ({ path, name: path.split(".").pop() || path }));
}

function normalizeLimit(limit: number | undefined): number | undefined {
  if (limit === undefined || Number.isNaN(limit)) return undefined;
  return Math.min(Math.max(Math.trunc(limit), 1), 1000);
}
