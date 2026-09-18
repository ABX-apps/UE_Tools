---
name: ue-editor
description: Automate a running Unreal Editor via Remote Control HTTP (default http://127.0.0.1:30010) on the user's machine. Unofficial; not affiliated with Epic Games. Requires the Remote Control plugin.
when-to-use: Unreal Editor Remote Control, list actors, selection, object properties, console command, HighResShot, viewport screenshot, WebControl port 30010
---

# Unreal Editor automation (Remote Control HTTP)

**Unofficial. Not affiliated with Epic Games.**

Requires a **running Unreal Editor on the user’s machine** (or a lab workstation) with the **Remote Control API** plugin and HTTP server (`WebControl.StartServer`, default `http://127.0.0.1:30010`).

The agent host often does **not** run the Editor. Set `UE_REMOTE_CONTROL_URL` to the machine that does. Fail closed on `editor_unreachable` — do not invent other ports or clone the engine.

Python remote execution (multicast UDP) is a different protocol; these tools use HTTP only.

## Tools

| Tool | Real HTTP |
| --- | --- |
| `ue_editor_status` | `GET /remote/info` |
| `ue_editor_actors_list` | `PUT /remote/object/call` `GetAllLevelActors` on `EditorActorSubsystem`, fallback `EditorLevelLibrary`. Optional name/class/limit. Class filter uses `PUT /remote/object/describe` (or `/remote/batch`). There is **no** `/remote/search/actors`. |
| `ue_editor_select` | `PUT /remote/object/call` `GetSelectedLevelActors`. No dedicated selection route. |
| `ue_editor_object_describe` | `PUT /remote/object/describe` |
| `ue_editor_object_get` | `PUT /remote/object/property` `READ_ACCESS` |
| `ue_editor_object_set` | Mutating. Requires `confirm=true`. `PUT /remote/object/property` `WRITE_TRANSACTION_ACCESS` (default) |
| `ue_editor_console` | `PUT /remote/object/call` `KismetSystemLibrary.ExecuteConsoleCommand`. Needs remote console execution enabled. |
| `ue_editor_highresshot` | Wraps console `HighResShot`. File on Editor host; no viewport bytes over HTTP. |
| `ue_editor_screenshot` | **Gap.** Confirms reachability. `/remote/object/thumbnail` is asset thumbs, not the viewport. |

```
ue-tools editor status
ue-tools editor actors list [--name <substr>] [--class <substr>] [--limit <n>]
ue-tools editor select
ue-tools editor object describe <objectPath>
ue-tools editor object get <objectPath> [propertyName]
ue-tools editor object set <objectPath> <propertyName> <jsonValue> --confirm
ue-tools editor console "stat fps"
ue-tools editor highresshot
ue-tools editor screenshot
```

`--fixture` / `UE_FIXTURE=1` mocks Remote Control HTTP so CI does not need an Editor.
