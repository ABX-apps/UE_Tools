import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { editorActorsList, editorConsole, editorStatus } from "../dist/editor.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli.js");

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
});

test("fixture editor actors list", () => {
  const result = run(["--fixture", "editor", "actors", "list"], fixtureEnv());
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.via.functionName, "GetAllLevelActors");
  assert.ok(body.actors.some((actor) => actor.name === "PlayerStart_0"));
});

test("fixture editor console", () => {
  const result = run(["--fixture", "editor", "console", "stat", "fps"], fixtureEnv());
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, "stat fps");
  assert.equal(body.via.objectPath, "/Script/Engine.Default__KismetSystemLibrary");
});

test("fixture editor screenshot is a documented gap", () => {
  const result = run(["--fixture", "editor", "screenshot"], fixtureEnv());
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.available, false);
  assert.equal(body.imageReturned, false);
  assert.match(body.reason, /no viewport-capture/);
  assert.match(body.workaround, /HighResShot/);
});

test("live editor status fails closed when Editor is unreachable", () => {
  const result = run(["editor", "status"], liveEditorEnv("http://127.0.0.1:1"));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /editor_unreachable/);
  assert.match(result.stderr, /does not host the Editor/);
});

test("fetch client talks to mock Remote Control HTTP", async () => {
  const server = await listenMock();
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const cfg = { fixture: false, remoteControlUrl: url, timeoutMs: 1000 };
    const statusBody = await editorStatus(cfg);
    assert.equal(statusBody.reachable, true);
    assert.equal(statusBody.source, "remote-control");

    const actorBody = await editorActorsList(cfg);
    assert.ok(actorBody.actors.some((actor) => actor.name === "MockActor"));

    const consoleBody = await editorConsole("stat fps", cfg);
    assert.equal(consoleBody.command, "stat fps");
  } finally {
    await closeServer(server);
  }
});

function listenMock() {
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
            HttpRoutes: [{ Path: "/remote/info", Verb: "Get", Description: "mock" }],
          }),
        );
        return;
      }
      if (req.method === "PUT" && req.url === "/remote/object/call") {
        if (body.functionName === "GetAllLevelActors") {
          res.end(JSON.stringify({ ReturnValue: ["/Game/Map.Map:PersistentLevel.MockActor"] }));
          return;
        }
        if (body.functionName === "ExecuteConsoleCommand") {
          res.end(JSON.stringify({ Command: body.parameters?.Command }));
          return;
        }
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
