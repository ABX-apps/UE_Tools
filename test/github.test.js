import assert from "node:assert/strict";
import test from "node:test";
import { firstNonEmpty, normalizeRemoteControlUrl } from "../dist/config.js";
import { buildSearchQuery, extractSearchFilters, scopeSearchQuery } from "../dist/github.js";
import { normalizeRepoPath } from "../dist/paths.js";
import { rankSymbolHit } from "../dist/source.js";

test("search query is scoped to the given owner/repo", () => {
  assert.equal(scopeSearchQuery("FName", "EpicGames", "UnrealEngine"), "FName repo:EpicGames/UnrealEngine");
  assert.equal(
    scopeSearchQuery("FName repo:someone/else", "YourOrg", "UnrealEngine"),
    "FName repo:YourOrg/UnrealEngine",
  );
});

test("search query accepts path/language/extension filters", () => {
  assert.equal(
    buildSearchQuery("FName", "EpicGames", "UnrealEngine", {
      path: "Engine/Source/Runtime",
      language: "C++",
      extension: "h",
    }),
    "FName path:Engine/Source/Runtime language:C++ extension:h repo:EpicGames/UnrealEngine",
  );
  const extracted = extractSearchFilters("FName path:Engine/Source extension:h repo:other/x");
  assert.equal(extracted.needle, "FName");
  assert.equal(extracted.filters.path, "Engine/Source");
  assert.equal(extracted.filters.extension, "h");
});

test("repo paths reject traversal", () => {
  assert.equal(normalizeRepoPath("/Engine/Source/"), "Engine/Source");
  assert.throws(() => normalizeRepoPath("../Secrets"), { code: "invalid_path" });
});

test("symbol heuristic prefers UCLASS header declarations", () => {
  const ranked = rankSymbolHit("UEngine", {
    path: "Engine/Source/Runtime/Engine/Classes/Engine/Engine.h",
    name: "Engine.h",
    repo: "EpicGames/UnrealEngine",
    snippet: "UCLASS() class UEngine;",
    textMatches: [{ fragment: "UCLASS() class UEngine;", property: "content" }],
  });
  assert.equal(ranked.kind, "uclass");
  assert.ok(ranked.score >= 20);
});

test("unexpanded plugin placeholders are treated as unset", () => {
  assert.equal(firstNonEmpty("${GITHUB_TOKEN}", "  ", null), null);
  assert.equal(firstNonEmpty("${GITHUB_TOKEN}", "secret"), "secret");
});

test("Remote Control URL must be http(s)", () => {
  assert.equal(normalizeRemoteControlUrl("http://127.0.0.1:30010/"), "http://127.0.0.1:30010");
  assert.throws(() => normalizeRemoteControlUrl("ftp://127.0.0.1:30010"), { code: "usage" });
  assert.throws(() => normalizeRemoteControlUrl("not-a-url"), { code: "usage" });
});
