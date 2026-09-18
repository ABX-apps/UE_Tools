# DOMAIN — Unreal Engine source + Editor Remote Control

**Unofficial.** This project is **not affiliated with, endorsed, or sponsored by Epic Games.** Unreal Engine is a trademark of Epic Games, Inc. Do not treat this package as Epic documentation, and do not redistribute Unreal Engine source.

Two independent backends share this package. Neither clones Unreal Engine.

## 1. Source search/read (GitHub)

Default coordinates for public installers: `https://github.com/EpicGames/UnrealEngine` (requires an Epic GitHub account that can access that repo). Default git ref is **`release`**.

| Field | Public default | Override |
| --- | --- | --- |
| `owner` | `EpicGames` | `UE_OWNER` (e.g. `ABX-apps` for a private fork) |
| `repo` | `UnrealEngine` | `UE_REPO` |
| `ref` | `release` | `UE_REF` or `--ref` |
| `source` | `github` | `--fixture` / `UE_FIXTURE=1` |

Auth: `GITHUB_TOKEN` or `GH_TOKEN` with access to the configured repo. Fail closed when missing, except fixture mode and `status`. Never emit the token.

| Op | Output |
| --- | --- |
| `status` | `{ owner, repo, ref, source, tokenConfigured }` |
| `search` | `{ query, repo, total, incomplete, hits[] }` with `path`, `name`, `repo`, `snippet` |
| `symbol` / `find-class` | Heuristic `.h` search + rank for `UCLASS` / `class FFoo` declarations |
| `history` / `blame` | Last N commits touching a path via `GET /repos/{owner}/{repo}/commits?path=&sha=` (not line-level blame) |
| `file get` | `{ path, ref, sha?, size, encoding, content }` |
| `tree` | `{ path, ref, entries[] }` |
| `modules list` | heuristic child dirs of `Engine/Source/Runtime` and `Engine/Source/Editor` |

`search` accepts `path` / `language` / `extension` filters (CLI flags or GitHub qualifiers). `repo:` in the user query is stripped and replaced with the configured owner/repo.

## 2. Editor automation (Remote Control HTTP)

Talks to a **running Unreal Editor on the user’s machine** (or a lab workstation) via Epic’s **Web Remote Control HTTP API** (`fetch`, no SDK). Python remote execution (multicast UDP) is a different protocol and is not used.

The agent host (including Grok Bot Linux) typically does **not** run the Editor. Point `UE_REMOTE_CONTROL_URL` at the machine that does.

| Field | Default | Override |
| --- | --- | --- |
| `remoteControlUrl` | `http://127.0.0.1:30010` | `UE_REMOTE_CONTROL_URL` or `--url` |
| `source` | `remote-control` | `--fixture` / `UE_FIXTURE=1` (in-memory mock HTTP) |

Requirements on that machine: Unreal Editor running, **Remote Control API** plugin enabled, HTTP server started (`WebControl.StartServer` / enable on startup). Live calls fail closed (`editor_unreachable`) if that URL does not answer.

Verified routes (Epic [Remote Control API HTTP Reference](https://dev.epicgames.com/documentation/unreal-engine/remote-control-api-http-reference-for-unreal-engine) / `WebRemoteControl`):

| HTTP | Role in this package |
| --- | --- |
| `GET /remote/info` | `editor status` ping + route list |
| `PUT /remote/object/call` | function calls (actors, selection, console) |
| `PUT /remote/object/describe` | `editor object describe` — metadata (Name, Class, Properties) |
| `PUT /remote/object/property` | `editor object get` (`READ_ACCESS`) / `editor object set` (`WRITE_TRANSACTION_ACCESS` or `WRITE_ACCESS`) |
| `PUT /remote/batch` | used when `editor actors list --class` needs Class from describe |
| `PUT /remote/search/assets` | Asset Registry — **not** level actors |
| `PUT /remote/object/thumbnail` | Content Browser **asset** thumbnails — **not** viewport |

There is **no** `/remote/search/actors` and **no** viewport-capture HTTP route. Selection is `EditorActorSubsystem.GetSelectedLevelActors` over `/remote/object/call`, not a dedicated route.

| Op | How |
| --- | --- |
| `editor status` / `ue_editor_status` | `GET /remote/info` → `{ reachable, url, source, routes[] }` |
| `editor actors list` / `ue_editor_actors_list` | `PUT /remote/object/call` `{ objectPath: "/Script/UnrealEd.Default__EditorActorSubsystem", functionName: "GetAllLevelActors" }`, fallback `/Script/EditorScriptingUtilities.Default__EditorLevelLibrary`. Optional `--name` / `--class` / `--limit`. Class filter describes matching actors. Returns `{ via, actors: [{ path, name, class? }], truncated }` |
| `editor select` / `ue_editor_select` | `PUT /remote/object/call` `GetSelectedLevelActors` on `EditorActorSubsystem`, then `EditorLevelLibrary` |
| `editor object describe` / `ue_editor_object_describe` | `PUT /remote/object/describe` `{ objectPath }` |
| `editor object get` / `ue_editor_object_get` | `PUT /remote/object/property` `{ objectPath, propertyName?, access: "READ_ACCESS" }` |
| `editor object set` / `ue_editor_object_set` | Mutating. Requires `--confirm` / `confirm: true`. `PUT /remote/object/property` with `WRITE_TRANSACTION_ACCESS` (default) or `WRITE_ACCESS` |
| `editor console` / `ue_editor_console` | `PUT /remote/object/call` `{ objectPath: "/Script/Engine.Default__KismetSystemLibrary", functionName: "ExecuteConsoleCommand", parameters: { Command } }`. Editor must allow remote console execution (`bAllowConsoleCommandRemoteExecution`). |
| `editor highresshot` / `ue_editor_highresshot` | Wraps `editor console HighResShot`. PNG is on the **Editor host**; bytes are not returned. |
| `editor screenshot` / `ue_editor_screenshot` | **Gap.** Confirms Editor via `/remote/info`, then reports that viewport bytes are not available over Remote Control HTTP. Workaround: `editor highresshot`. |

## Out of scope

Cloning or redistributing the engine, Epic endorsement or logos, Python remote execution, cooking/UBT, inventing HTTP routes that the plugin does not register, line-level git blame.
