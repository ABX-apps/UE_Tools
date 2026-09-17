# UE_Tools

Private bot tooling for **Abraham’s Grok Bot / Cursor agents** to search and read the Unreal Engine fork at [`ABX-apps/UnrealEngine`](https://github.com/ABX-apps/UnrealEngine) (EpicGames/UnrealEngine fork, default branch **`release`**).

This repo does **not** clone the engine, does **not** automate the Unreal Editor, and is **not** published to any marketplace.

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

## Auth

Live GitHub calls fail closed unless one of these is set:

- `GITHUB_TOKEN`
- `GH_TOKEN`

The token must be a GitHub PAT with **`repo`** access to the **private** fork `ABX-apps/UnrealEngine`. Copy [`.env.example`](./.env.example) locally if you want a dotenv file — **never commit secrets**.

Optional:

| Variable | Default |
| --- | --- |
| `UE_OWNER` | `ABX-apps` |
| `UE_REPO` | `UnrealEngine` |
| `UE_REF` | `release` |
| `UE_FIXTURE` | unset (`1` = dry mode) |

`status` never prints the token. Fixture/dry mode (`--fixture` or `UE_FIXTURE=1`) uses the bundled tree under `fixtures/ue-src/` and does not call GitHub.

## CLI

```bash
ue-tools status
ue-tools search FName
ue-tools file get Engine/Source/Runtime/Core/Public/CoreMinimal.h
ue-tools tree Engine/Source/Runtime
ue-tools modules list
```

`--ref <ref>` overrides `UE_REF` for file/tree/modules. Search uses GitHub’s indexed default branch (`release`).

## Prove (no GitHub)

```bash
npm test
npx ue-tools --help
npx ue-tools --fixture search Core
npx ue-tools --fixture modules list
```

## Agent plugin (local, private)

Agent Plugins 1.0 layout at the repo root:

- `plugin.json`
- `mcp.json` — stdio MCP (`node ${PLUGIN_ROOT}/dist/mcp.js`)
- `skills/ue-source/SKILL.md`

Load as a local plugin directory after `npm install && npm run build`. The host must inherit `GITHUB_TOKEN` / `GH_TOKEN` into the MCP subprocess. **Do not publish this to Cursor/Grok marketplaces.**

MCP tools: `ue_status`, `ue_search`, `ue_file_get`, `ue_tree`, `ue_modules_list`.

The CLI uses Node stdlib + `fetch` only. `@modelcontextprotocol/sdk` is the MCP server runtime (stdio). Do not clone UnrealEngine into this repo.
