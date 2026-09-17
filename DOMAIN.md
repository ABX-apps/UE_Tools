# DOMAIN — Unreal Engine source access

Private read/search surface over Abraham’s GitHub fork of Unreal Engine.
This package does **not** drive the Unreal Editor, UBT, or live sessions.

## Coordinates

| Field | Default | Override |
| --- | --- | --- |
| `owner` | `ABX-apps` | `UE_OWNER` |
| `repo` | `UnrealEngine` | `UE_REPO` |
| `ref` | `release` | `UE_REF` or `--ref` |
| `source` | `github` | `--fixture` / `UE_FIXTURE=1` |

Live calls target `https://github.com/ABX-apps/UnrealEngine` (private EpicGames/UnrealEngine fork). Search is GitHub code search, which indexes the repo default branch (`release`). File/tree reads use `ref`.

Auth: `GITHUB_TOKEN` or `GH_TOKEN` (PAT with `repo` on that fork). Fail closed when missing, except fixture/dry mode and `status`. Never log or emit the token.

## Operations

| Op | Input | Output |
| --- | --- | --- |
| `status` | — | `{ owner, repo, ref, source, tokenConfigured }` — no secrets |
| `search` | `query` | `{ query, repo, total, incomplete, hits[] }` where each hit is `{ path, name, sha?, htmlUrl?, textMatches[] }` |
| `file get` | `path`, `ref` | `{ path, ref, sha?, size, encoding, content }` UTF-8 text |
| `tree` | `path`, `ref` | `{ path, ref, entries[] }` where each entry is `{ name, path, type: "file"\|"dir", size? }` |
| `modules list` | `ref` | `{ ref, modules[] }` where each module is `{ name, layer: "Runtime"\|"Editor", path }` |

`modules list` is a **heuristic**: immediate child directories of `Engine/Source/Runtime` and `Engine/Source/Editor` from `tree`. It is not a UBT module graph.

## Out of scope

Editor automation, PIE, cooking, building, launching, writing/mutating the fork, cloning the engine into this repo.
