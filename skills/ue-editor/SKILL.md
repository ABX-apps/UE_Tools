---
name: ue-editor
description: Automate a running Unreal Editor via Remote Control HTTP. Default http://127.0.0.1:30010 only when the MCP/CLI process and the Editor share a host. Unofficial; not affiliated with Epic Games. Requires the Remote Control API plugin.
when-to-use: Unreal Editor Remote Control, list actors, selection, object properties, console command, HighResShot, viewport screenshot, WebControl.StartServer, port 30010, UE_REMOTE_CONTROL_URL
---

# Unreal Editor automation (Remote Control HTTP)

**Unofficial. Not affiliated with Epic Games.**

## Where the request runs

Remote Control is reached from **wherever the MCP or CLI process runs** (the process host). The agent’s loopback is not the user’s Editor unless that process is on the Editor host.

- Default `http://127.0.0.1:30010` works only when the process host and the Editor host are the same machine.
- If the process host and the Editor host differ, set `UE_REMOTE_CONTROL_URL` to an address the process host can route to. On the Editor, bind beyond loopback (`[HTTPServer.Listeners]` `DefaultBindAddress=0.0.0.0` or the machine IP, in project or engine config) and allow TCP 30010 from the process host. Do not expose Remote Control to the public internet.
- An SSH local forward or a VPN is a valid general pattern. Point `UE_REMOTE_CONTROL_URL` at the forwarded address. Loopback then means the tunnel you configured.
- If no network path exists, run the `ue-tools` CLI on the Editor machine (a shell on that host). Some agent executors cannot target another machine; the parent agent must run Editor commands on the Editor host.
- Failure stays `editor_unreachable`. Do not treat a failed localhost call as proof the user’s Editor is down.

## Setup (any Unreal user)

1. Enable the **Remote Control API** plugin.
2. Run `WebControl.StartServer` (default `http://127.0.0.1:30010` on the Editor host).
3. Optional: `WebControl.EnableServerOnStartup`.
4. Optional, for `editor console` / `editor highresshot`: allow remote console execution (`bAllowConsoleCommandRemoteExecution`).
5. If the process host is not the Editor host, set `UE_REMOTE_CONTROL_URL` as above.

Other Unreal services (for example **Zen**) listen on other ports and are **not** Remote Control. Fail closed on `editor_unreachable` — do not invent HTTP routes or clone the engine.

Python remote execution (multicast UDP) is a different protocol; these tools use HTTP only.

## Tools

| Tool | Real HTTP |
| --- | --- |
| `ue_editor_status` | `GET /remote/info` |
| `ue_editor_actors_list` | `PUT /remote/object/call` `GetAllLevelActors` on `EditorActorSubsystem`, then `EditorLevelLibrary` (the path Epic’s HTTP reference still shows). Optional name/class/limit. Class filter uses `PUT /remote/object/describe` (or `/remote/batch`). There is **no** `/remote/search/actors` and no third documented actor-list route. |
| `ue_editor_select` | `PUT /remote/object/call` `GetSelectedLevelActors` on `EditorActorSubsystem`, then `EditorLevelLibrary`. No dedicated selection route. |
| `ue_editor_object_describe` | `PUT /remote/object/describe` |
| `ue_editor_object_get` | `PUT /remote/object/property` `READ_ACCESS` |
| `ue_editor_object_set` | Mutating. Requires `confirm=true`. `PUT /remote/object/property` `WRITE_TRANSACTION_ACCESS` (default) |
| `ue_editor_console` | `PUT /remote/object/call` `KismetSystemLibrary.ExecuteConsoleCommand`. Needs remote console execution enabled. Output includes `command`, `url`, `via`, `httpStatus`, and `raw` JSON. An empty body is common and is not console stdout. |
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

## Console output

`editor console` / `ue_editor_console` returns the command string, the Remote Control URL, the via route (`PUT /remote/object/call`), the HTTP status when a response arrived, and the raw JSON (`raw`, also copied to `result`).

`ExecuteConsoleCommand` has no output parameter. Remote Control often returns `{}` or an empty `ReturnValue`. That does not include console stdout. Check the Editor Output Log on the Editor host. HTTP success is not proof that `LiveCoding.Compile` compiled successfully. Epic does not document a Remote Control route that returns the Output Log; do not invent log scraping.

## MCP on another machine

Bots that run this MCP server on a different machine than the Unreal Editor must set `UE_REMOTE_CONTROL_URL` to an address that machine can route to. Fixture mode (`UE_FIXTURE=1` or `--fixture`) is for CI and does not need an Editor.
