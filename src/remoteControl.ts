import { UeToolsError } from "./types.js";

export type RcRequest = {
  method: "GET" | "PUT";
  path: string;
  body?: unknown;
};

export type RcResponse = {
  status: number;
  json: unknown;
};

export type RcTransport = {
  baseUrl: string;
  request(req: RcRequest): Promise<RcResponse>;
};

const UNREACHABLE_HINT =
  "Unreal Editor is not reachable over Remote Control HTTP. Enable the Remote Control API plugin, start the HTTP server (default http://127.0.0.1:30010), and set UE_REMOTE_CONTROL_URL to that machine. Grok Bot's Linux computer does not host the Editor.";

const FIXTURE_ACTORS = [
  {
    path: "/Game/Maps/FixtureMap.FixtureMap:PersistentLevel.Floor",
    name: "Floor",
    class: "/Script/Engine.StaticMeshActor",
    properties: {
      RelativeLocation: { X: 0, Y: 0, Z: 0 },
      bHidden: false,
    },
  },
  {
    path: "/Game/Maps/FixtureMap.FixtureMap:PersistentLevel.PlayerStart_0",
    name: "PlayerStart_0",
    class: "/Script/Engine.PlayerStart",
    properties: {
      RelativeLocation: { X: 200, Y: 0, Z: 92 },
      bHidden: false,
    },
  },
  {
    path: "/Game/Maps/FixtureMap.FixtureMap:PersistentLevel.DirectionalLight_0",
    name: "DirectionalLight_0",
    class: "/Script/Engine.DirectionalLight",
    properties: {
      RelativeLocation: { X: 0, Y: 0, Z: 500 },
      bHidden: false,
    },
  },
] as const;

type FixtureActor = (typeof FIXTURE_ACTORS)[number];

const fixturePropertyStore = new Map<string, Record<string, unknown>>();

export function resetFixtureRemoteControl(): void {
  fixturePropertyStore.clear();
}

export function createFetchTransport(baseUrl: string, timeoutMs: number): RcTransport {
  return {
    baseUrl,
    async request(req) {
      const url = `${baseUrl}${req.path}`;
      let res: Response;
      try {
        res = await fetch(url, {
          method: req.method,
          headers: req.body
            ? { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "ue-tools" }
            : { Accept: "application/json", "User-Agent": "ue-tools" },
          body: req.body === undefined ? undefined : JSON.stringify(req.body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        throw new UeToolsError("editor_unreachable", `${UNREACHABLE_HINT} (${describeFetchError(err)}). Tried ${url}`);
      }
      const text = await res.text();
      let json: unknown = null;
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = { raw: text };
        }
      }
      if (!res.ok) {
        throw new UeToolsError("editor_error", rcErrorMessage(json, res.status, url), res.status);
      }
      return { status: res.status, json };
    },
  };
}

export function createFixtureTransport(): RcTransport {
  return {
    baseUrl: "fixture://remote-control",
    async request(req) {
      if (req.method === "GET" && req.path === "/remote/info") {
        return {
          status: 200,
          json: {
            HttpRoutes: [
              { Path: "/remote/info", Verb: "Get", Description: "Get information about different routes available on this API." },
              { Path: "/remote/object/call", Verb: "Put", Description: "Call a function on a remote object." },
              { Path: "/remote/object/property", Verb: "Put", Description: "Read or write a property on a remote object." },
              { Path: "/remote/object/describe", Verb: "Put", Description: "Describe a remote object." },
              { Path: "/remote/batch", Verb: "Put", Description: "Allows batching multiple calls into one request." },
              { Path: "/remote/search/assets", Verb: "Put", Description: "Search for assets" },
              { Path: "/remote/object/thumbnail", Verb: "Put", Description: "Get an object's thumbnail" },
            ],
          },
        };
      }
      if (req.method === "PUT" && req.path === "/remote/object/call") {
        return handleFixtureCall(req.body);
      }
      if (req.method === "PUT" && req.path === "/remote/object/describe") {
        return { status: 200, json: fixtureDescribe(asRecord(req.body).objectPath) };
      }
      if (req.method === "PUT" && req.path === "/remote/object/property") {
        return handleFixtureProperty(asRecord(req.body));
      }
      if (req.method === "PUT" && req.path === "/remote/batch") {
        return handleFixtureBatch(req.body);
      }
      throw new UeToolsError("editor_error", `Fixture Remote Control has no handler for ${req.method} ${req.path}`);
    },
  };
}

function handleFixtureCall(bodyUnknown: unknown): RcResponse {
  const body = asRecord(bodyUnknown);
  const functionName = String(body.functionName ?? "");
  if (functionName === "GetAllLevelActors") {
    return {
      status: 200,
      json: { ReturnValue: FIXTURE_ACTORS.map((actor) => actor.path) },
    };
  }
  if (functionName === "GetSelectedLevelActors") {
    return {
      status: 200,
      json: { ReturnValue: [FIXTURE_ACTORS[1].path] },
    };
  }
  if (functionName === "ExecuteConsoleCommand") {
    const parameters = asRecord(body.parameters);
    return { status: 200, json: { Command: String(parameters.Command ?? "") } };
  }
  return { status: 200, json: {} };
}

function handleFixtureProperty(body: Record<string, unknown>): RcResponse {
  const objectPath = String(body.objectPath ?? "");
  const access = String(body.access ?? "READ_ACCESS");
  const propertyName = typeof body.propertyName === "string" ? body.propertyName : undefined;
  const props = fixtureProps(objectPath);
  if (access === "READ_ACCESS") {
    if (!propertyName) return { status: 200, json: { ...props } };
    return { status: 200, json: { [propertyName]: props[propertyName] ?? null } };
  }
  if (access === "WRITE_ACCESS" || access === "WRITE_TRANSACTION_ACCESS") {
    const incoming = asRecord(body.propertyValue);
    const updates = propertyName && propertyName in incoming ? incoming : propertyName ? { [propertyName]: body.propertyValue } : incoming;
    Object.assign(props, updates);
    return { status: 200, json: {} };
  }
  throw new UeToolsError("editor_error", `Unsupported property access: ${access}`);
}

function handleFixtureBatch(bodyUnknown: unknown): RcResponse {
  const body = asRecord(bodyUnknown);
  const requests = Array.isArray(body.Requests) ? body.Requests : [];
  const responses = requests.map((entry, index) => {
    const req = asRecord(entry);
    const requestId = req.RequestId ?? index + 1;
    const url = String(req.URL ?? "");
    const verb = String(req.Verb ?? "PUT").toUpperCase();
    try {
      let inner: RcResponse;
      if (verb === "PUT" && url === "/remote/object/describe") {
        inner = { status: 200, json: fixtureDescribe(asRecord(req.Body).objectPath) };
      } else if (verb === "PUT" && url === "/remote/object/property") {
        inner = handleFixtureProperty(asRecord(req.Body));
      } else if (verb === "PUT" && url === "/remote/object/call") {
        inner = handleFixtureCall(req.Body);
      } else {
        inner = { status: 404, json: { errorMessage: `unhandled batch URL ${url}` } };
      }
      return { RequestId: requestId, ResponseCode: inner.status, ResponseBody: inner.json };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { RequestId: requestId, ResponseCode: 500, ResponseBody: { errorMessage: message } };
    }
  });
  return { status: 200, json: { Responses: responses } };
}

function fixtureDescribe(objectPathUnknown: unknown) {
  const objectPath = String(objectPathUnknown ?? "");
  const actor = findFixtureActor(objectPath);
  const name = actor?.name ?? (objectPath.split(".").pop() || objectPath);
  return {
    Name: name,
    Class: actor?.class ?? "/Script/Engine.Actor",
    Properties: [
      { Name: "RelativeLocation", Description: "", Type: "FVector", ContainerType: "", KeyType: "", Metadata: {} },
      { Name: "bHidden", Description: "", Type: "uint8", ContainerType: "", KeyType: "", Metadata: {} },
    ],
  };
}

function fixtureProps(objectPath: string): Record<string, unknown> {
  const existing = fixturePropertyStore.get(objectPath);
  if (existing) return existing;
  const actor = findFixtureActor(objectPath);
  const initial = actor ? { ...actor.properties } : {};
  fixturePropertyStore.set(objectPath, initial);
  return initial;
}

function findFixtureActor(objectPath: string): FixtureActor | undefined {
  return FIXTURE_ACTORS.find((actor) => actor.path === objectPath || actor.name === objectPath);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function describeFetchError(err: unknown): string {
  if (err && typeof err === "object") {
    const named = err as { name?: string; message?: string; cause?: { code?: string } };
    if (named.name === "TimeoutError" || named.name === "AbortError") return "timed out";
    if (named.cause?.code) return named.cause.code;
    if (named.message) return named.message;
  }
  return err instanceof Error ? err.message : String(err);
}

function rcErrorMessage(json: unknown, status: number, url: string): string {
  if (json && typeof json === "object") {
    const rec = json as Record<string, unknown>;
    for (const key of ["errorMessage", "ErrorMessage", "message", "error"]) {
      if (typeof rec[key] === "string" && rec[key]) return `${rec[key]} (${status} ${url})`;
    }
  }
  return `Remote Control HTTP ${status} from ${url}`;
}
