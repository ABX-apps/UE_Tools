import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
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
} from "../dist/editor.js";
import { assertAllowedRcRoute, createFetchTransport, resetFixtureRemoteControl } from "../dist/remoteControl.js";
import { UeToolsError } from "../dist/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli.js");
const FLOOR = "/Game/Maps/FixtureMap.FixtureMap:PersistentLevel.Floor";

function run(args, env = process.env) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd: root,
    env,
  });
}

function fixtureEnv() {
  const env = { ...process.env };
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  env.UE_FIXTURE = "1";
  return env;
}

function liveEditorEnv(url) {
  const env = { ...process.env };
  delete env.UE_FIXTURE;
  env.UE_REMOTE_CONTROL_URL = url;
  env.UE_REMOTE_CONTROL_TIMEOUT_MS = "500";
  return env;
}

test("fixture editor status", () => {
  const result = run(["--fixture", "editor", "status"], fixtureEnv());
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.reachable, true);
  assert.equal(body.source, "fixture");
  assert.ok(body.routes.some((route) => route.path === "/remote/info"));
  assert.ok(body.routes.some((route) => route.path === "/remote/object/call"));
  assert.ok(body.routes.some((route) => route.path === "/remote/object/describe"));
  assert.ok(body.routes.some((route) => route.path === "/remote/object/property"));
});

test("fixture editor actors list", () => {
  const result = run(["--fixture", "editor", "actors", "list"], fixtureEnv());
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.via.functionName, "GetAllLevelActors");
  assert.ok(body.actors.some((actor) => actor.name === "PlayerStart_0"));
});

test("fixture editor actors list name/class/limit filters", () => {
  const named = run(["--fixture", "editor", "actors", "list", "--name", "Player"], fixtureEnv());
  assert.equal(named.status, 0, named.stderr);
  const namedBody = JSON.parse(named.stdout);
  assert.deepEqual(
    namedBody.actors.map((actor) => actor.name),
    ["PlayerStart_0"],
  );

  const classified = run(["--fixture", "editor", "actors", "list", "--class", "StaticMeshActor"], fixtureEnv());
  assert.equal(classified.status, 0, classified.stderr);
  const classBody = JSON.parse(classified.stdout);
  assert.equal(classBody.actors.length, 1);
  assert.equal(classBody.actors[0].name, "Floor");
  assert.match(classBody.actors[0].class, /StaticMeshActor/);

  const limited = run(["--fixture", "editor", "actors", "list", "--limit", "1"], fixtureEnv());
  assert.equal(limited.status, 0, limited.stderr);
  const limitBody = JSON.parse(limited.stdout);
  assert.equal(limitBody.actors.length, 1);
  assert.equal(limitBody.truncated, true);
});

test("fixture editor select uses GetSelectedLevelActors", () => {
  const result = run(["--fixture", "editor", "select"], fixtureEnv());
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.via.functionName, "GetSelectedLevelActors");
  assert.deepEqual(
    body.actors.map((actor) => actor.name),
    ["PlayerStart_0"],
  );
});

test("fixture editor object describe and confirm", () => {
  const describe = run(["--fixture", "editor", "object", "describe", FLOOR], fixtureEnv());
  assert.equal(describe.status, 0, describe.stderr);
  const described = JSON.parse(describe.stdout);
  assert.equal(described.via.path, "/remote/object/describe");
  assert.equal(described.describe.Name, "Floor");
  assert.match(described.describe.Class, /StaticMeshActor/);

  const denied = run(["--fixture", "editor", "object", "set", FLOOR, "bHidden", "true"], fixtureEnv());
  assert.equal(denied.status, 1);
  assert.match(denied.stderr, /confirm_required/);

  const set = run(
    ["--fixture", "editor", "object", "set", FLOOR, "bHidden", "true", "--confirm"],
    fixtureEnv(),
  );
  assert.equal(set.status, 0, set.stderr);
  const setBody = JSON.parse(set.stdout);
  assert.equal(setBody.access, "WRITE_TRANSACTION_ACCESS");
});

test("fixture object set round-trips in process", async () => {
  resetFixtureRemoteControl();
  const cfg = { fixture: true, remoteControlUrl: "fixture://remote-control", timeoutMs: 1000 };
  await editorObjectSet(FLOOR, "bHidden", true, cfg, { confirm: true });
  const got = await editorObjectGet(FLOOR, "bHidden", cfg);
  assert.equal(got.properties.bHidden, true);
});

test("fixture editor console", () => {
  const result = run(["--fixture", "editor", "console", "stat", "fps"], fixtureEnv());
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, "stat fps");
  assert.equal(body.via.objectPath, "/Script/Engine.Default__KismetSystemLibrary");
});

test("fixture editor highresshot wraps console", () => {
  const result = run(["--fixture", "editor", "highresshot"], fixtureEnv());
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, "HighResShot");
  assert.equal(body.imageReturned, false);
  assert.match(body.note, /Saved\/Screenshots/);
});

test("fixture editor screenshot is a documented gap", () => {
  const result = run(["--fixture", "editor", "screenshot"], fixtureEnv());
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.available, false);
  assert.equal(body.imageReturned, false);
  assert.match(body.reason, /no viewport-capture/);
  assert.match(body.workaround, /highresshot|HighResShot/);
});

test("live editor status fails closed when Editor is unreachable", () => {
  const result = run(["editor", "status"], liveEditorEnv("http://127.0.0.1:1"));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /editor_unreachable/);
  assert.match(result.stderr, /WebControl\.StartServer/);
  assert.match(result.stderr, /Zen/);
});

test("fetch client talks to mock Remote Control HTTP", async () => {
  const server = await listenMock();
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const cfg = { fixture: false, remoteControlUrl: url, timeoutMs: 1000 };
    const statusBody = await editorStatus(cfg);
    assert.equal(statusBody.reachable, true);
    assert.equal(statusBody.source, "remote-control");

    const actorBody = await editorActorsList(cfg, { name: "Mock", limit: 5 });
    assert.ok(actorBody.actors.some((actor) => actor.name === "MockActor"));

    const classed = await editorActorsList(cfg, { class: "PlayerStart" });
    assert.equal(classed.actors.length, 1);
    assert.equal(classed.actors[0].name, "MockActor");

    const selected = await editorSelect(cfg);
    assert.equal(selected.actors[0].name, "MockActor");

    const described = await editorObjectDescribe("/Game/Map.Map:PersistentLevel.MockActor", cfg);
    assert.equal(described.describe.Class, "/Script/Engine.PlayerStart");

    await editorObjectSet("/Game/Map.Map:PersistentLevel.MockActor", "bHidden", true, cfg, { confirm: true });
    const got = await editorObjectGet("/Game/Map.Map:PersistentLevel.MockActor", "bHidden", cfg);
    assert.equal(got.properties.bHidden, true);

    const consoleBody = await editorConsole("stat fps", cfg);
    assert.equal(consoleBody.command, "stat fps");

    const shot = await editorHighResShot(cfg);
    assert.equal(shot.command, "HighResShot");

    const paths = [];
    const screenshotServer = await listenTrackingMock(paths);
    try {
      const shotUrl = `http://127.0.0.1:${screenshotServer.address().port}`;
      const shotCfg = { fixture: false, remoteControlUrl: shotUrl, timeoutMs: 1000 };
      const gap = await editorScreenshot(shotCfg);
      assert.equal(gap.available, false);
      assert.equal(gap.thumbnailRoute, "/remote/object/thumbnail");
      assert.deepEqual(paths, ["/remote/info"]);
      assert.ok(!paths.includes("/remote/object/thumbnail"));
    } finally {
      await closeServer(screenshotServer);
    }
  } finally {
    await closeServer(server);
  }
});

test("refuses invented Remote Control HTTP routes", () => {
  assert.throws(
    () => assertAllowedRcRoute("GET", "/remote/viewport/capture"),
    (err) => err instanceof UeToolsError && err.code === "editor_error" && /viewport/.test(err.message),
  );
  assert.throws(
    () => assertAllowedRcRoute("PUT", "/remote/object/thumbnail"),
    (err) => err instanceof UeToolsError && err.code === "editor_error" && /thumbnail/.test(err.message),
  );
  assert.throws(
    () => assertAllowedRcRoute("PUT", "/remote/search/actors"),
    (err) => err instanceof UeToolsError && err.code === "editor_error",
  );
});

test("non-Remote-Control HTTP at the URL fails closed as editor_unreachable", async () => {
  const server = http.createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: "ok", service: "not-remote-control" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const cfg = { fixture: false, remoteControlUrl: url, timeoutMs: 1000 };
    await assert.rejects(
      () => editorStatus(cfg),
      (err) => err instanceof UeToolsError && err.code === "editor_unreachable" && /HttpRoutes/.test(err.message),
    );
  } finally {
    await closeServer(server);
  }
});

test("HTML at the Remote Control URL fails closed as editor_unreachable", async () => {
  const server = http.createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end("<!doctype html><html><body>not remote control</body></html>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const transport = createFetchTransport(url, 1000);
    await assert.rejects(
      () => transport.request({ method: "GET", path: "/remote/info" }),
      (err) => err instanceof UeToolsError && err.code === "editor_unreachable" && /HTML/.test(err.message),
    );
  } finally {
    await closeServer(server);
  }
});

function listenTrackingMock(paths) {
  const server = http.createServer((req, res) => {
    paths.push(req.url);
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      if (req.method === "GET" && req.url === "/remote/info") {
        res.end(JSON.stringify({ HttpRoutes: [{ Path: "/remote/info", Verb: "Get" }] }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ errorMessage: "unhandled mock route" }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function listenMock() {
  const actors = ["/Game/Map.Map:PersistentLevel.MockActor"];
  const props = { "/Game/Map.Map:PersistentLevel.MockActor": { bHidden: false, RelativeLocation: { X: 0, Y: 0, Z: 0 } } };
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : {};
      res.setHeader("Content-Type", "application/json");
      if (req.method === "GET" && req.url === "/remote/info") {
        res.end(
          JSON.stringify({
            HttpRoutes: [
              { Path: "/remote/info", Verb: "Get", Description: "mock" },
              { Path: "/remote/object/describe", Verb: "Put", Description: "mock" },
              { Path: "/remote/object/property", Verb: "Put", Description: "mock" },
              { Path: "/remote/batch", Verb: "Put", Description: "mock" },
            ],
          }),
        );
        return;
      }
      if (req.method === "PUT" && req.url === "/remote/object/call") {
        if (body.functionName === "GetAllLevelActors" || body.functionName === "GetSelectedLevelActors") {
          res.end(JSON.stringify({ ReturnValue: actors }));
          return;
        }
        if (body.functionName === "ExecuteConsoleCommand") {
          res.end(JSON.stringify({ Command: body.parameters?.Command }));
          return;
        }
      }
      if (req.method === "PUT" && req.url === "/remote/object/describe") {
        res.end(
          JSON.stringify({
            Name: "MockActor",
            Class: "/Script/Engine.PlayerStart",
            Properties: [{ Name: "bHidden", Type: "uint8" }],
          }),
        );
        return;
      }
      if (req.method === "PUT" && req.url === "/remote/object/property") {
        const store = props[body.objectPath] ?? (props[body.objectPath] = {});
        if (body.access === "READ_ACCESS") {
          if (body.propertyName) {
            res.end(JSON.stringify({ [body.propertyName]: store[body.propertyName] ?? null }));
          } else {
            res.end(JSON.stringify(store));
          }
          return;
        }
        Object.assign(store, body.propertyValue ?? {});
        res.end(JSON.stringify({}));
        return;
      }
      if (req.method === "PUT" && req.url === "/remote/batch") {
        const responses = (body.Requests ?? []).map((request) => {
          if (request.URL === "/remote/object/describe") {
            return {
              RequestId: request.RequestId,
              ResponseCode: 200,
              ResponseBody: {
                Name: "MockActor",
                Class: "/Script/Engine.PlayerStart",
                Properties: [],
              },
            };
          }
          return { RequestId: request.RequestId, ResponseCode: 404, ResponseBody: null };
        });
        res.end(JSON.stringify({ Responses: responses }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ errorMessage: "unhandled mock route" }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}
