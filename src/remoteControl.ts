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
            ? { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "ABX-apps-ue-tools" }
            : { Accept: "application/json", "User-Agent": "ABX-apps-ue-tools" },
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
              { Path: "/remote/search/assets", Verb: "Put", Description: "Search for assets" },
              { Path: "/remote/object/thumbnail", Verb: "Put", Description: "Get an object's thumbnail" },
            ],
          },
        };
      }
      if (req.method === "PUT" && req.path === "/remote/object/call") {
        const body = (req.body ?? {}) as { objectPath?: string; functionName?: string; parameters?: { Command?: string } };
        if (body.functionName === "GetAllLevelActors") {
          return {
            status: 200,
            json: {
              ReturnValue: [
                "/Game/Maps/FixtureMap.FixtureMap:PersistentLevel.Floor",
                "/Game/Maps/FixtureMap.FixtureMap:PersistentLevel.PlayerStart_0",
                "/Game/Maps/FixtureMap.FixtureMap:PersistentLevel.DirectionalLight_0",
              ],
            },
          };
        }
        if (body.functionName === "ExecuteConsoleCommand") {
          return { status: 200, json: { Command: body.parameters?.Command ?? "" } };
        }
        return { status: 200, json: {} };
      }
      throw new UeToolsError("editor_error", `Fixture Remote Control has no handler for ${req.method} ${req.path}`);
    },
  };
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
