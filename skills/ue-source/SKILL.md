---
name: ue-source
description: Search and read Unreal Engine source on GitHub (default EpicGames/UnrealEngine, ref release) for users who already have engine access. Override UE_OWNER/UE_REPO for a private fork. Unofficial; not affiliated with Epic Games.
when-to-use: Unreal Engine source, UE module, Engine/Source, UObject, UBT module list, read a file from EpicGames/UnrealEngine
---

# Unreal Engine source (GitHub)

**Unofficial. Not affiliated with Epic Games.** Do not clone or redistribute the engine.

Default repo is **`EpicGames/UnrealEngine`**, ref **`release`**. Set `UE_OWNER` / `UE_REPO` / `UE_REF` for a private fork (for example `ABX-apps` / `UnrealEngine` / `release`). The caller must already have GitHub access to that repo.

For a **running Editor** (actors, console commands), use the `ue-editor` skill and `ue_editor_*` tools.

## Auth

`GITHUB_TOKEN` or `GH_TOKEN` with read access to the configured repo. Fixture/dry mode (`UE_FIXTURE=1` or `--fixture`) uses the bundled stub tree (not Epic source).

## Tools

| Tool | Use |
| --- | --- |
| `ue_status` | Confirm owner/repo/ref/source. Never expect a token in the result. |
| `ue_search` | Code search scoped to the configured repo. `repo:` is added. |
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

If a call fails with `missing_token`, stop and report that the host needs a GitHub token with access to the configured repo — do not clone.
