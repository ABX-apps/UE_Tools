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

## Paste blurb

Unofficial Cursor plugin for Unreal Engine workflows: drive a locally running Unreal Editor over Epic’s Remote Control HTTP API (status, level actors, selection, object describe/get/set, console commands) and optionally search/read engine source on GitHub if you already have access (default `EpicGames/UnrealEngine` @ `release`; override with `UE_OWNER`/`UE_REPO`/`UE_REF` for a private fork). Not affiliated with Epic Games. Requires Unreal Editor on the user’s machine with the Remote Control plugin enabled (`UE_REMOTE_CONTROL_URL`, default `http://127.0.0.1:30010`). Configure `GITHUB_TOKEN`/`GH_TOKEN` and the Editor URL in Plugins → Configure. Does not ship Unreal Engine source.
