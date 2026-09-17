# UE_Tools

**Unofficial.** This project is **not affiliated with, endorsed, or sponsored by Epic Games.** Unreal Engine is a trademark of Epic Games, Inc. No Epic logos or endorsement. This package does **not** redistribute Unreal Engine source.

Cursor plugin + CLI for:

1. Automating a **running Unreal Editor** via Epic’s **Remote Control HTTP API**.
2. Optionally searching/reading engine source on GitHub if you **already have access** (default [`EpicGames/UnrealEngine`](https://github.com/EpicGames/UnrealEngine), ref **`release`**).

Data shape: [`DOMAIN.md`](./DOMAIN.md). Marketplace notes: [`MARKETPLACE.md`](./MARKETPLACE.md).

## Install from Cursor Marketplace

Once listed: in Cursor, open the Marketplace, search for **ue-tools**, and install. Then set env as needed (`UE_REMOTE_CONTROL_URL`, and `GITHUB_TOKEN` only if you use source search).

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

Live Editor calls use `fetch` against the Web Remote Control HTTP server (default **`http://127.0.0.1:30010`**).

The Editor must run on **your machine** (or a lab workstation). Agent hosts such as Grok Bot Linux do not host Unreal Editor. Set `UE_REMOTE_CONTROL_URL` to the machine where:

1. Unreal Editor is running.
2. The **Remote Control API** plugin is enabled.
3. The HTTP server is listening (`WebControl.StartServer`, or enable on startup).
4. For `editor console`: allow remote console execution in Remote Control settings (`bAllowConsoleCommandRemoteExecution`).

If the URL is down, commands fail closed with `editor_unreachable`.

| Variable | Public default |
| --- | --- |
| `UE_OWNER` / `UE_REPO` / `UE_REF` | `EpicGames` / `UnrealEngine` / `release` |
| `UE_REMOTE_CONTROL_URL` | `http://127.0.0.1:30010` |
| `UE_FIXTURE` | unset (`1` = dry mode: source fixture tree + mock Remote Control HTTP) |

Private fork example: `UE_OWNER=ABX-apps` `UE_REPO=UnrealEngine` `UE_REF=release`.

`status` never prints the GitHub token.

## CLI

```bash
# Source (GitHub; default EpicGames/UnrealEngine @ release)
ue-tools status
ue-tools search FName
ue-tools file get Engine/Source/Runtime/Core/Public/CoreMinimal.h
ue-tools tree Engine/Source/Runtime
ue-tools modules list

# Editor (Remote Control HTTP on the user's machine)
ue-tools editor status
ue-tools editor actors list
ue-tools editor console "stat fps"
ue-tools editor screenshot
```

`--url` overrides `UE_REMOTE_CONTROL_URL`. `--ref` overrides `UE_REF` for file/tree/modules.

`editor screenshot` documents a **gap**: Remote Control has no viewport-capture HTTP route (`/remote/object/thumbnail` is asset thumbs only). Use `editor console HighResShot` to write a PNG on the Editor host.

## Prove (no GitHub, no Editor)

```bash
npm test
npx ue-tools --help
npx ue-tools --fixture search Core
npx ue-tools --fixture modules list
npx ue-tools --fixture editor status
npx ue-tools --fixture editor actors list
```

## Agent plugin layout

- `plugin.json`
- `mcp.json` — stdio MCP (`node ${PLUGIN_ROOT}/dist/mcp.js`)
- `skills/ue-source/SKILL.md`, `skills/ue-editor/SKILL.md`

Inherit `GITHUB_TOKEN` / `GH_TOKEN` for source tools and `UE_REMOTE_CONTROL_URL` for Editor tools.

Source MCP tools: `ue_status`, `ue_search`, `ue_file_get`, `ue_tree`, `ue_modules_list`.

Editor MCP tools: `ue_editor_status`, `ue_editor_actors_list`, `ue_editor_console`, `ue_editor_screenshot`.

The CLI uses Node stdlib + `fetch`. `@modelcontextprotocol/sdk` is the MCP server runtime.
