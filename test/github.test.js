import assert from "node:assert/strict";
import test from "node:test";
import { scopeSearchQuery } from "../dist/github.js";
import { normalizeRepoPath } from "../dist/paths.js";

test("search query is scoped to the given owner/repo", () => {
  assert.equal(scopeSearchQuery("FName", "EpicGames", "UnrealEngine"), "FName repo:EpicGames/UnrealEngine");
  assert.equal(
    scopeSearchQuery("FName repo:someone/else", "ABX-apps", "UnrealEngine"),
    "FName repo:ABX-apps/UnrealEngine",
  );
});

test("repo paths reject traversal", () => {
  assert.equal(normalizeRepoPath("/Engine/Source/"), "Engine/Source");
  assert.throws(() => normalizeRepoPath("../Secrets"), { code: "invalid_path" });
});
