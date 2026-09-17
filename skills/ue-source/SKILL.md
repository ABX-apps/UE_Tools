---
name: ue-source
description: Search and read the private ABX-apps/UnrealEngine fork (default git ref `release`) via GitHub. Use when an agent needs Unreal Engine C++/Build.cs source, module directories, or file contents without cloning the engine.
when-to-use: Unreal Engine source, UE module, Engine/Source, UObject, UBT module list, read a file from ABX-apps/UnrealEngine
---

# Unreal Engine source (private fork)

Read-only GitHub access to `ABX-apps/UnrealEngine` (EpicGames/UnrealEngine fork). Default ref is **`release`**. Do not clone the engine into the working repo. Do not invent Unreal Editor automation, PIE, cook, or UBT build commands from this skill.

## Auth

The host process must provide `GITHUB_TOKEN` or `GH_TOKEN` (PAT with **`repo`** on the private fork). Fixture/dry mode (`UE_FIXTURE=1` or CLI `--fixture`) uses the bundled tree and does not call GitHub.

## Tools (MCP `ue-source`)

| Tool | Use |
| --- | --- |
| `ue_status` | Confirm owner/repo/ref/source. Never expect a token in the result. |
| `ue_search` | Code search scoped to this repo. Pass the query only; `repo:` is added. Indexed default branch is `release`. |
| `ue_file_get` | Read one UTF-8 file at `ref`. |
| `ue_tree` | List a directory. Start at `Engine/Source/Runtime` or `Engine/Source/Editor`. |
| `ue_modules_list` | Heuristic top-level Runtime/Editor module dirs from `tree`. Not a UBT dependency graph. |

Equivalent CLI (`ue-tools` / `ue-src`) after `npm install && npm run build`:

```
ue-tools status
ue-tools search <query>
ue-tools file get <path>
ue-tools tree [path]
ue-tools modules list
```

## How to look things up

1. `ue_status` if coordinates are unclear.
2. `ue_search` for symbols, class names, or `filename:*.Build.cs`.
3. `ue_file_get` on a hit path.
4. `ue_tree` to browse siblings; `ue_modules_list` for a coarse module index.

Stay inside this fork. Quote paths as repo-relative (`Engine/Source/...`). If a call fails with `missing_token`, stop and report that the host env needs a `repo`-scoped PAT — do not fall back to cloning.
