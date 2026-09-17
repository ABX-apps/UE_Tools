# DOMAIN — Unreal Engine source + Editor Remote Control

Private bot surface for Abraham’s Grok Bot / Cursor agents.

Two independent backends share this package. Neither clones Unreal Engine. Neither is published to a marketplace.

## 1. Source search/read (GitHub)

Coordinates for the private fork `https://github.com/ABX-apps/UnrealEngine` (EpicGames/UnrealEngine fork).

| Field | Default | Override |
| --- | --- | --- |
| `owner` | `ABX-apps` | `UE_OWNER` |
| `repo` | `UnrealEngine` | `UE_REPO` |
| `ref` | `release` | `UE_REF` or `--ref` |
| `source` | `github` | `--fixture` / `UE_FIXTURE=1` |

Auth: `GITHUB_TOKEN` or `GH_TOKEN` (PAT with `repo`). Fail closed when missing, except fixture mode and `status`. Never emit the token.

| Op | Output |
| --- | --- |
| `status` | `{ owner, repo, ref, source, tokenConfigured }` |
| `search` | `{ query, repo, total, incomplete, hits[] }` |
| `file get` | `{ path, ref, sha?, size, encoding, content }` |
| `tree` | `{ path, ref, entries[] }` |
| `modules list` | heuristic child dirs of `Engine/Source/Runtime` and `Engine/Source/Editor` |

## 2. Editor automation (Remote Control HTTP)

Talks to a **running Unreal Editor** via Epic’s **Web Remote Control HTTP API** (`fetch`, no SDK). Python remote execution (multicast UDP) is a different protocol and is not used.

| Field | Default | Override |
| --- | --- | --- |
| `remoteControlUrl` | `http://127.0.0.1:30010` | `UE_REMOTE_CONTROL_URL` or `--url` |
| `source` | `remote-control` | `--fixture` / `UE_FIXTURE=1` (in-memory mock HTTP) |

**Where the Editor runs:** Grok Bot’s Linux computer does **not** host Unreal Editor. Point `UE_REMOTE_CONTROL_URL` at the user’s Windows/macOS workstation or a lab machine with Editor + **Remote Control API** plugin enabled and the HTTP server started (`WebControl.StartServer` / enable on startup). Live calls fail closed (`editor_unreachable`) if that URL does not answer.

Verified routes (ABX-apps/UnrealEngine `release`, `WebRemoteControl.cpp` / `WebRemoteControlEditorRoutes.cpp`, Epic HTTP reference):

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
| `editor actors list` / `ue_editor_actors_list` | `PUT /remote/object/call` `{ objectPath: "/Script/UnrealEd.Default__EditorActorSubsystem", functionName: "GetAllLevelActors" }`, fallback `/Script/EditorScriptingUtilities.Default__EditorLevelLibrary` (Epic-documented). Returns `{ via, actors: [{ path, name }] }`. |
| `editor console` / `ue_editor_console` | `PUT /remote/object/call` `{ objectPath: "/Script/Engine.Default__KismetSystemLibrary", functionName: "ExecuteConsoleCommand", parameters: { Command } }`. Editor must allow remote console execution (`bAllowConsoleCommandRemoteExecution` in Remote Control settings). |
| `editor screenshot` / `ue_editor_screenshot` | **Gap.** Confirms Editor via `/remote/info`, then reports that viewport bytes are not available over Remote Control HTTP. Workaround: `editor console HighResShot` writes PNG on the **Editor host** (`Saved/Screenshots`). |

## Out of scope

Cloning the engine, marketplace publish, Python remote execution, cooking/UBT, inventing HTTP routes that the plugin does not register.
