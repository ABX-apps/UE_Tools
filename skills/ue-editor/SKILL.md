---
name: ue-editor
description: Automate a running Unreal Editor via Epic Remote Control HTTP (default http://127.0.0.1:30010). Use for editor status, listing level actors, and console commands. Does not run on Grok Bot Linux unless UE_REMOTE_CONTROL_URL points at a workstation or lab Editor.
when-to-use: Unreal Editor Remote Control, list actors, console command, HighResShot, viewport screenshot, WebControl port 30010
---

# Unreal Editor automation (Remote Control HTTP)

Requires a **running Unreal Editor** with the **Remote Control API** plugin and HTTP server (`WebControl.StartServer`, default `http://127.0.0.1:30010`).

Grok Bot’s Linux computer does **not** host the Editor. Set `UE_REMOTE_CONTROL_URL` to the user’s workstation or a lab machine. Fail closed on `editor_unreachable` — do not invent other ports or clone the engine.

Python remote execution (multicast UDP) is a different protocol; these tools use HTTP only.

## Tools

| Tool | Real HTTP |
| --- | --- |
| `ue_editor_status` | `GET /remote/info` |
| `ue_editor_actors_list` | `PUT /remote/object/call` `GetAllLevelActors` on `EditorActorSubsystem`, fallback `EditorLevelLibrary`. There is **no** `/remote/search/actors`. |
| `ue_editor_console` | `PUT /remote/object/call` `KismetSystemLibrary.ExecuteConsoleCommand`. Needs remote console execution enabled. |
| `ue_editor_screenshot` | **Gap.** Confirms reachability. `/remote/object/thumbnail` is asset thumbs, not the viewport. Workaround: `ue_editor_console` with `HighResShot` (file on Editor host). |

```
ue-tools editor status
ue-tools editor actors list
ue-tools editor console "stat fps"
ue-tools editor screenshot
```

`--fixture` / `UE_FIXTURE=1` mocks Remote Control HTTP so CI does not need an Editor.
