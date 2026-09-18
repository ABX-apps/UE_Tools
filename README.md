# UE_Tools

**Unofficial.** This project is **not affiliated with, endorsed, or sponsored by Epic Games.** Unreal Engine is a trademark of Epic Games, Inc. No Epic logos or endorsement. This package does **not** redistribute Unreal Engine source.

Cursor plugin + CLI for:

1. Automating a **running Unreal Editor** via Epic’s **Remote Control HTTP API**.
2. Optionally searching/reading engine source on GitHub if you **already have access** (default [`EpicGames/UnrealEngine`](https://github.com/EpicGames/UnrealEngine), ref **`release`**).

Data shape: [`DOMAIN.md`](./DOMAIN.md). Marketplace notes: [`MARKETPLACE.md`](./MARKETPLACE.md).

## Install from Cursor Marketplace

Once listed: in Cursor, open the Marketplace, search for **ue-tools**, and install. Then open **Plugins → Configure** and set:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GITHUB_TOKEN` or `GH_TOKEN` | For source search | PAT that can read the configured GitHub repo |
| `UE_REMOTE_CONTROL_URL` | For a non-default Editor | Remote Control HTTP base URL (default `http://127.0.0.1:30010`) |
| `UE_OWNER` / `UE_REPO` / `UE_REF` | Optional | Private-fork override (default `EpicGames` / `UnrealEngine` / `release`) |

The Agent Plugins 1.0 `plugin.json` schema does **not** allow a `variables` field (`additionalProperties: false`). Cursor Marketplace Configure is declared in [`.cursor-plugin/plugin.json`](./.cursor-plugin/plugin.json) and wired through `mcp.json` env placeholders. Unexpanded `${VAR}` strings are treated as unset. Local installs can keep using process env / [`.env.example`](./.env.example) instead.

Until it is listed, install from this repo (local plugin directory after `npm install && npm run build`).

## Local install

```bash
git clone https://github.com/ABX-apps/UE_Tools.git
cd UE_Tools
npm install
npm run build
npx ue-tools --help
```

`ue-src` is an alias for `ue-tools`.

## Auth (source search)

Live GitHub calls fail closed unless `GITHUB_TOKEN` or `GH_TOKEN` is set. The token must be able to read the configured repo (Epic’s GitHub org for the public default, or `repo` scope on a private fork). Copy [`.env.example`](./.env.example) locally — **never commit secrets**.

## Editor Remote Control

Live Editor calls use `fetch` against Epic’s Web Remote Control HTTP server. Only those documented HTTP routes are used. If the URL is down or is not Remote Control, commands fail closed with `editor_unreachable`.

### Setup (any Unreal user)

1. Enable the **Remote Control API** plugin in your project.
2. In the Editor console, run `WebControl.StartServer`. The HTTP server listens at **`http://127.0.0.1:30010`** by default.
3. Optional: `WebControl.EnableServerOnStartup` so the server starts with the Editor.
4. Optional, for `editor console` / `editor highresshot`: allow remote console execution in Remote Control settings (`bAllowConsoleCommandRemoteExecution`).
5. If the Editor runs on another lab host, set `UE_REMOTE_CONTROL_URL` to that host’s Remote Control HTTP base URL. Bind the HTTP server so the client can reach it, and allow the port through the host firewall. Do not expose Remote Control to the public internet.

Other Unreal services (for example **Zen**) listen on other ports and are **not** Remote Control. Point `UE_REMOTE_CONTROL_URL` only at the Web Remote Control HTTP server.

| Variable | Public default |
| --- | --- |
| `UE_OWNER` / `UE_REPO` / `UE_REF` | `EpicGames` / `UnrealEngine` / `release` |
| `UE_REMOTE_CONTROL_URL` | `http://127.0.0.1:30010` |
| `UE_FIXTURE` | unset (`1` = dry mode: source fixture tree + mock Remote Control HTTP) |

Override `UE_OWNER` / `UE_REPO` / `UE_REF` when searching a private GitHub fork instead of `EpicGames/UnrealEngine`.

`status` never prints the GitHub token.

## CLI

```bash
# Source (GitHub; default EpicGames/UnrealEngine @ release)
ue-tools status
ue-tools search FName
ue-tools search --path Engine/Source/Runtime --extension h FName
ue-tools symbol FName
ue-tools find-class UEngine
ue-tools history Engine/Source/Runtime/Core/Public/CoreMinimal.h
ue-tools file get Engine/Source/Runtime/Core/Public/CoreMinimal.h
ue-tools tree Engine/Source/Runtime
ue-tools modules list

# Editor (Remote Control HTTP on the user's machine)
ue-tools editor status
ue-tools editor actors list --name Player --class PlayerStart --limit 20
ue-tools editor select
ue-tools editor object describe /Game/Maps/Map.Map:PersistentLevel.Floor
ue-tools editor object get /Game/Maps/Map.Map:PersistentLevel.Floor RelativeLocation
ue-tools editor object set /Game/Maps/Map.Map:PersistentLevel.Floor bHidden true --confirm
ue-tools editor console "stat fps"
ue-tools editor highresshot
ue-tools editor screenshot
```

`--url` overrides `UE_REMOTE_CONTROL_URL`. `--ref` overrides `UE_REF` for file/tree/modules/history.

`editor screenshot` documents a **gap**: Remote Control has no viewport-capture HTTP route (`/remote/object/thumbnail` is asset thumbs only). `editor highresshot` wraps `editor console HighResShot` and writes a PNG on the Editor host.

`editor object set` is mutating and requires `--confirm` (MCP: `confirm: true`). Default write access is `WRITE_TRANSACTION_ACCESS` (undoable). Pass `--no-transaction` for `WRITE_ACCESS`.

## Prove (no GitHub, no Editor)

```bash
npm test
npx ue-tools --help
npx ue-tools --fixture search Core
npx ue-tools --fixture search --path Engine/Source/Runtime --extension h Core
npx ue-tools --fixture symbol FName
npx ue-tools --fixture history Engine/Source/Runtime/Core/Public/CoreMinimal.h
npx ue-tools --fixture modules list
npx ue-tools --fixture editor status
npx ue-tools --fixture editor actors list --name Floor
npx ue-tools --fixture editor select
npx ue-tools --fixture editor object describe /Game/Maps/FixtureMap.FixtureMap:PersistentLevel.Floor
```

## Agent plugin layout

- `plugin.json` — Agent Plugins 1.0 portable manifest (no `variables`; schema forbids extra fields)
- `.cursor-plugin/plugin.json` — Cursor Marketplace Configure variables
- `mcp.json` — stdio MCP (`node ${PLUGIN_ROOT}/dist/mcp.js`) plus env placeholders
- `skills/ue-source/SKILL.md`, `skills/ue-editor/SKILL.md`

Source MCP tools: `ue_status`, `ue_search`, `ue_symbol`, `ue_history`, `ue_file_get`, `ue_tree`, `ue_modules_list`.

Editor MCP tools: `ue_editor_status`, `ue_editor_actors_list`, `ue_editor_select`, `ue_editor_object_describe`, `ue_editor_object_get`, `ue_editor_object_set`, `ue_editor_console`, `ue_editor_highresshot`, `ue_editor_screenshot`.

The CLI uses Node stdlib + `fetch`. `@modelcontextprotocol/sdk` is the MCP server runtime.
