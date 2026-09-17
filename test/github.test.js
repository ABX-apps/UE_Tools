import assert from "node:assert/strict";
import test from "node:test";
import { scopeSearchQuery } from "../dist/github.js";
import { normalizeRepoPath } from "../dist/paths.js";

test("search query is forced to ABX-apps/UnrealEngine", () => {
  assert.equal(scopeSearchQuery("FName", "ABX-apps", "UnrealEngine"), "FName repo:ABX-apps/UnrealEngine");
  assert.equal(
    scopeSearchQuery("FName repo:someone/else", "ABX-apps", "UnrealEngine"),
    "FName repo:ABX-apps/UnrealEngine",
  );
});

test("repo paths reject traversal", () => {
  assert.equal(normalizeRepoPath("/Engine/Source/"), "Engine/Source");
  assert.throws(() => normalizeRepoPath("../Secrets"), { code: "invalid_path" });
});
