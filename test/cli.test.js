import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

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

function liveNoTokenEnv() {
  const env = { ...process.env };
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  delete env.UE_FIXTURE;
  return env;
}

test("cli --help", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ue-tools/);
  assert.match(result.stdout, /Not affiliated with Epic Games/);
  assert.match(result.stdout, /EpicGames/);
  assert.match(result.stdout, /search/);
  assert.match(result.stdout, /symbol/);
  assert.match(result.stdout, /history/);
  assert.match(result.stdout, /file get/);
  assert.match(result.stdout, /modules list/);
  assert.match(result.stdout, /editor status/);
  assert.match(result.stdout, /editor actors list/);
  assert.match(result.stdout, /editor object describe/);
  assert.match(result.stdout, /editor select/);
  assert.match(result.stdout, /editor console/);
  assert.match(result.stdout, /highresshot/);
});

test("fixture status has no secrets", () => {
  const result = run(["--fixture", "status"], fixtureEnv());
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.owner, "EpicGames");
  assert.equal(body.repo, "UnrealEngine");
  assert.equal(body.ref, "release");
  assert.equal(body.source, "fixture");
  assert.equal(body.tokenConfigured, false);
  assert.equal("token" in body, false);
  assert.doesNotMatch(result.stdout, /ghp_|github_pat_/i);
});

test("UE_OWNER overrides default for private forks", () => {
  const env = fixtureEnv();
  env.UE_OWNER = "ABX-apps";
  const result = run(["--fixture", "status"], env);
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.owner, "ABX-apps");
  assert.equal(body.repo, "UnrealEngine");
});

test("fixture search Core", () => {
  const result = run(["--fixture", "search", "Core"], fixtureEnv());
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.ok(body.total >= 1);
  const paths = body.hits.map((hit) => hit.path);
  assert.ok(paths.some((p) => p.includes("Core.Build.cs")));
  assert.ok(paths.some((p) => p.includes("CoreMinimal.h")));
  assert.ok(body.hits.every((hit) => hit.repo === "EpicGames/UnrealEngine"));
  assert.ok(body.hits.some((hit) => typeof hit.snippet === "string" && hit.snippet.length > 0));
});

test("fixture search path and extension filters", () => {
  const result = run(
    ["--fixture", "search", "--path", "Engine/Source/Runtime/Core", "--extension", "h", "Core"],
    fixtureEnv(),
  );
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.ok(body.total >= 1);
  assert.ok(body.hits.every((hit) => hit.path.startsWith("Engine/Source/Runtime/Core/") && hit.path.endsWith(".h")));
  assert.ok(!body.hits.some((hit) => hit.path.includes("UnrealEd")));
});

test("fixture symbol FName prefers header declaration", () => {
  const result = run(["--fixture", "symbol", "FName"], fixtureEnv());
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.name, "FName");
  assert.ok(body.hits.some((hit) => hit.path.endsWith("CoreMinimal.h") && hit.kind === "class"));
});

test("fixture find-class UEngine", () => {
  const result = run(["--fixture", "find-class", "UEngine"], fixtureEnv());
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.ok(body.hits[0].path.endsWith("Engine.h"));
  assert.equal(body.hits[0].kind, "uclass");
});

test("fixture history for a file", () => {
  const result = run(
    ["--fixture", "history", "--limit", "1", "Engine/Source/Runtime/Core/Public/CoreMinimal.h"],
    fixtureEnv(),
  );
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.lineBlame, false);
  assert.equal(body.commits.length, 1);
  assert.match(body.note, /commits API/);
});

test("fixture file get", () => {
  const result = run(
    ["--fixture", "file", "get", "Engine/Source/Runtime/Core/Public/CoreMinimal.h"],
    fixtureEnv(),
  );
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.match(body.content, /CORE_MINIMAL_FIXTURE/);
  assert.equal(body.encoding, "utf-8");
});

test("fixture tree Runtime", () => {
  const result = run(["--fixture", "tree", "Engine/Source/Runtime"], fixtureEnv());
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  const names = body.entries.map((entry) => entry.name);
  assert.deepEqual(names.slice().sort(), ["Core", "CoreUObject", "Engine"]);
});

test("fixture modules list", () => {
  const result = run(["--fixture", "modules", "list"], fixtureEnv());
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  const runtime = body.modules.filter((m) => m.layer === "Runtime").map((m) => m.name);
  const editor = body.modules.filter((m) => m.layer === "Editor").map((m) => m.name);
  assert.ok(runtime.includes("Core"));
  assert.ok(runtime.includes("Engine"));
  assert.deepEqual(editor, ["UnrealEd"]);
});

test("live search fails closed without token", () => {
  const result = run(["search", "Core"], liveNoTokenEnv());
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing_token/);
});

test("plugin manifests parse", () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(root, "plugin.json"), "utf8"));
  assert.equal(plugin.name, "ue-tools");
  assert.equal(plugin.version, "0.2.0");
  assert.match(plugin.$schema, /plugin\.schema\.json$/);
  assert.match(plugin.description, /Not affiliated with Epic Games/i);
  assert.equal(plugin.license, "MIT");
  assert.equal("variables" in plugin, false);
  const mcp = JSON.parse(fs.readFileSync(path.join(root, "mcp.json"), "utf8"));
  assert.equal(mcp.mcpServers["ue-tools"].type, "stdio");
  assert.equal(mcp.mcpServers["ue-tools"].command, "node");
  assert.equal(mcp.mcpServers["ue-tools"].env.GITHUB_TOKEN, "${GITHUB_TOKEN}");
  const cursorPlugin = JSON.parse(fs.readFileSync(path.join(root, ".cursor-plugin", "plugin.json"), "utf8"));
  const vars = cursorPlugin.variables.properties;
  assert.ok(vars.GITHUB_TOKEN);
  assert.ok(vars.GH_TOKEN);
  assert.ok(vars.UE_REMOTE_CONTROL_URL);
  assert.ok(vars.UE_OWNER);
  assert.ok(vars.UE_REPO);
  assert.ok(vars.UE_REF);
});
