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
  assert.match(result.stdout, /search/);
  assert.match(result.stdout, /file get/);
  assert.match(result.stdout, /modules list/);
});

test("fixture status has no secrets", () => {
  const result = run(["--fixture", "status"], fixtureEnv());
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.owner, "ABX-apps");
  assert.equal(body.repo, "UnrealEngine");
  assert.equal(body.ref, "release");
  assert.equal(body.source, "fixture");
  assert.equal(body.tokenConfigured, false);
  assert.equal("token" in body, false);
  assert.doesNotMatch(result.stdout, /ghp_|github_pat_/i);
});

test("fixture search Core", () => {
  const result = run(["--fixture", "search", "Core"], fixtureEnv());
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.ok(body.total >= 1);
  const paths = body.hits.map((hit) => hit.path);
  assert.ok(paths.some((p) => p.includes("Core.Build.cs")));
  assert.ok(paths.some((p) => p.includes("CoreMinimal.h")));
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
  assert.equal(plugin.name, "ue-source");
  assert.match(plugin.$schema, /plugin\.schema\.json$/);
  const mcp = JSON.parse(fs.readFileSync(path.join(root, "mcp.json"), "utf8"));
  assert.equal(mcp.mcpServers["ue-source"].type, "stdio");
  assert.equal(mcp.mcpServers["ue-source"].command, "node");
});
