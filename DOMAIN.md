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
| `search` | `{ query, repo, total, incomplete, hits[] }` |
| `file get` | `{ path, ref, sha?, size, encoding, content }` |
| `tree` | `{ path, ref, entries[] }` |
| `modules list` | heuristic child dirs of `Engine/Source/Runtime` and `Engine/Source/Editor` |

## 2. Editor automation (Remote Control HTTP)

Talks to a **running Unreal Editor on the user’s machine** (or a lab workstation) via Epic’s **Web Remote Control HTTP API** (`fetch`, no SDK). Python remote execution (multicast UDP) is a different protocol and is not used.

The agent host (including Grok Bot Linux) typically does **not** run the Editor. Point `UE_REMOTE_CONTROL_URL` at the machine that does.

| Field | Default | Override |
| --- | --- | --- |
| `remoteControlUrl` | `http://127.0.0.1:30010` | `UE_REMOTE_CONTROL_URL` or `--url` |
| `source` | `remote-control` | `--fixture` / `UE_FIXTURE=1` (in-memory mock HTTP) |

Requirements on that machine: Unreal Editor running, **Remote Control API** plugin enabled, HTTP server started (`WebControl.StartServer` / enable on startup). Live calls fail closed (`editor_unreachable`) if that URL does not answer.

Verified routes (`WebRemoteControl.cpp` / `WebRemoteControlEditorRoutes.cpp`, Epic HTTP reference):

| HTTP | Role in this package |
| --- | --- |
| `GET /remote/info` | `editor status` ping + route list |
| `PUT /remote/object/call` | function calls (actors, console) |
| `PUT /remote/search/assets` | Asset Registry — **not** level actors |
| `PUT /remote/object/thumbnail` | Content Browser **asset** thumbnails — **not** viewport |

There is **no** `/remote/search/actors` and **no** viewport-capture HTTP route.

| Op | How |
| --- | --- |
| `editor status` / `ue_editor_status` | `GET /remote/info` → `{ reachable, url, source, routes[] }` |
| `editor actors list` / `ue_editor_actors_list` | `PUT /remote/object/call` `{ objectPath: "/Script/UnrealEd.Default__EditorActorSubsystem", functionName: "GetAllLevelActors" }`, fallback `/Script/EditorScriptingUtilities.Default__EditorLevelLibrary`. Returns `{ via, actors: [{ path, name }] }`. |
| `editor console` / `ue_editor_console` | `PUT /remote/object/call` `{ objectPath: "/Script/Engine.Default__KismetSystemLibrary", functionName: "ExecuteConsoleCommand", parameters: { Command } }`. Editor must allow remote console execution (`bAllowConsoleCommandRemoteExecution`). |
| `editor screenshot` / `ue_editor_screenshot` | **Gap.** Confirms Editor via `/remote/info`, then reports that viewport bytes are not available over Remote Control HTTP. Workaround: `editor console HighResShot` writes PNG on the **Editor host** (`Saved/Screenshots`). |

## Out of scope

Cloning or redistributing the engine, Epic endorsement or logos, Python remote execution, cooking/UBT, inventing HTTP routes that the plugin does not register.
