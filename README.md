# UE_Tools

Private bot tooling for **Abraham’s Grok Bot / Cursor agents**:

1. Search/read the Unreal Engine fork at [`ABX-apps/UnrealEngine`](https://github.com/ABX-apps/UnrealEngine) (default branch **`release`**).
2. Automate a **running Unreal Editor** via Epic’s **Remote Control HTTP API**.

This repo does **not** clone the engine and is **not** published to any marketplace.

Data shape: [`DOMAIN.md`](./DOMAIN.md).

## Install

```bash
git clone https://github.com/ABX-apps/UE_Tools.git
cd UE_Tools
npm install
npm run build
npx ue-tools --help
```

`ue-src` is an alias for `ue-tools`.

## Auth (source)

Live GitHub calls fail closed unless `GITHUB_TOKEN` or `GH_TOKEN` is set (PAT with **`repo`** on the private fork). Copy [`.env.example`](./.env.example) locally — **never commit secrets**.

## Editor Remote Control

Live Editor calls use `fetch` against Epic’s Web Remote Control HTTP server (default **`http://127.0.0.1:30010`**).

**Grok Bot’s Linux computer will not host Unreal Editor.** Set `UE_REMOTE_CONTROL_URL` to the user’s workstation or a lab machine where:

1. Unreal Editor is running.
2. The **Remote Control API** plugin is enabled.
3. The HTTP server is listening (`WebControl.StartServer`, or enable on startup).
4. For `editor console`: allow remote console execution in Remote Control settings (`bAllowConsoleCommandRemoteExecution`).

If the URL is down, commands fail closed with `editor_unreachable`.

| Variable | Default |
| --- | --- |
| `UE_OWNER` / `UE_REPO` / `UE_REF` | `ABX-apps` / `UnrealEngine` / `release` |
| `UE_REMOTE_CONTROL_URL` | `http://127.0.0.1:30010` |
| `UE_FIXTURE` | unset (`1` = dry mode: source fixture tree + mock Remote Control HTTP) |

`status` never prints the GitHub token.

## CLI

```bash
# Source
ue-tools status
ue-tools search FName
ue-tools file get Engine/Source/Runtime/Core/Public/CoreMinimal.h
ue-tools tree Engine/Source/Runtime
ue-tools modules list

# Editor (Remote Control HTTP)
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

## Agent plugin (local, private)

- `plugin.json`
- `mcp.json` — stdio MCP (`node ${PLUGIN_ROOT}/dist/mcp.js`)
- `skills/ue-source/SKILL.md`, `skills/ue-editor/SKILL.md`

Load as a local plugin after `npm install && npm run build`. Inherit `GITHUB_TOKEN` / `GH_TOKEN` and, for Editor tools, `UE_REMOTE_CONTROL_URL`. **Do not publish to marketplaces.**

Source MCP tools: `ue_status`, `ue_search`, `ue_file_get`, `ue_tree`, `ue_modules_list`.

Editor MCP tools: `ue_editor_status`, `ue_editor_actors_list`, `ue_editor_console`, `ue_editor_screenshot`.

The CLI uses Node stdlib + `fetch`. `@modelcontextprotocol/sdk` is the MCP server runtime.
