---
name: ue-source
description: Search and read the private ABX-apps/UnrealEngine fork (default git ref `release`) via GitHub. Use when an agent needs Unreal Engine C++/Build.cs source, module directories, or file contents without cloning the engine.
when-to-use: Unreal Engine source, UE module, Engine/Source, UObject, UBT module list, read a file from ABX-apps/UnrealEngine
---

# Unreal Engine source (private fork)

Read-only GitHub access to `ABX-apps/UnrealEngine`. Default ref is **`release`**. Do not clone the engine.

For a **running Editor** (actors, console commands), use the `ue-editor` skill and `ue_editor_*` tools instead of guessing HTTP routes.

## Auth

`GITHUB_TOKEN` or `GH_TOKEN` (PAT with **`repo`**). Fixture/dry mode (`UE_FIXTURE=1` or `--fixture`) uses the bundled tree.

## Tools

| Tool | Use |
| --- | --- |
| `ue_status` | Confirm owner/repo/ref/source. Never expect a token in the result. |
| `ue_search` | Code search scoped to this repo. `repo:` is added. |
| `ue_file_get` | Read one UTF-8 file at `ref`. |
| `ue_tree` | List a directory. |
| `ue_modules_list` | Heuristic Runtime/Editor module dirs from `tree`. |

```
ue-tools status
ue-tools search <query>
ue-tools file get <path>
ue-tools tree [path]
ue-tools modules list
```

If a call fails with `missing_token`, stop and report that the host needs a `repo`-scoped PAT — do not clone.
