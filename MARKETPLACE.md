# Cursor Marketplace

Submit at **https://cursor.com/marketplace/publish** after the GitHub repo is public. Do not redistribute Unreal Engine source or use Epic logos.

## Configure variables

The portable Agent Plugins 1.0 schema (`plugin.json`) does **not** allow a `variables` field. Cursor Marketplace **Plugins → Configure** reads [`.cursor-plugin/plugin.json`](./.cursor-plugin/plugin.json):

| Variable | Secret? | Default if unset |
| --- | --- | --- |
| `GITHUB_TOKEN` | yes | none (source search fails closed) |
| `GH_TOKEN` | yes | alias of `GITHUB_TOKEN` |
| `UE_REMOTE_CONTROL_URL` | no | `http://127.0.0.1:30010` |
| `UE_OWNER` | no | `EpicGames` |
| `UE_REPO` | no | `UnrealEngine` |
| `UE_REF` | no | `release` |

`mcp.json` maps those names into the MCP process env. Unexpanded `${VAR}` placeholders are ignored. Never put token values in the repo.

Editor setup for any Unreal user: enable the Remote Control API plugin, run `WebControl.StartServer` (optional `WebControl.EnableServerOnStartup`), and optionally allow remote console execution. Remote Control is reached from the host running the MCP process. Default `http://127.0.0.1:30010` works only when that process and the Editor share a host. Otherwise set `UE_REMOTE_CONTROL_URL` to an address that process can route to (bind the Editor HTTP server beyond loopback and allow TCP 30010). Calls fail closed with `editor_unreachable`. Other Unreal services (for example Zen) on other ports are not Remote Control.

## Paste blurb

Unofficial Cursor plugin for Unreal Engine workflows: drive a running Unreal Editor over Epic’s Remote Control HTTP API (status, level actors, selection, object describe/get/set, console commands) and optionally search/read engine source on GitHub if you already have access (default `EpicGames/UnrealEngine` @ `release`; override with `UE_OWNER`/`UE_REPO`/`UE_REF` for a private fork). Not affiliated with Epic Games. Requires Unreal Editor with the Remote Control plugin enabled. `UE_REMOTE_CONTROL_URL` defaults to `http://127.0.0.1:30010` on the host that runs the plugin; set it when that host is not the Editor host. Configure `GITHUB_TOKEN`/`GH_TOKEN` and the Editor URL in Plugins → Configure. Does not ship Unreal Engine source.
