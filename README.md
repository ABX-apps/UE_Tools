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

Open the directory that contains `package.json` (the repository root), then install and build there:

```bash
git clone https://github.com/ABX-apps/UE_Tools.git
cd UE_Tools
npm install
npm run build
```

From that same root, prefer:

```bash
node dist/cli.js --help
npx --prefix . ue-tools --help
```

`package.json` `name` is `ue-tools`. The `bin` entries are `ue-tools` and `ue-src` (an alias), both `./dist/cli.js`.

Do not nest another `UE_Tools/` folder inside the clone (`…/UE_Tools/UE_Tools/`). `npx ue-tools` resolves the package from the current project. An extra nested folder hides `package.json` and the bin, so the command 404s. If that happens, `cd` to the directory that contains `package.json` and use `node dist/cli.js` or `npx --prefix . ue-tools`.

## Auth (source search)

Live GitHub calls fail closed unless `GITHUB_TOKEN` or `GH_TOKEN` is set. The token must be able to read the configured repo (Epic’s GitHub org for the public default, or `repo` scope on a private fork). Copy [`.env.example`](./.env.example) locally — **never commit secrets**.

## Editor Remote Control

Live Editor calls use `fetch` against Epic’s Web Remote Control HTTP server. Only those documented HTTP routes are used. If the URL is down or is not Remote Control, commands fail closed with `editor_unreachable`. A failed call to this process’s loopback does not mean the user’s Editor is down.

### Where the request runs

Remote Control is reached from **wherever the MCP or CLI process runs** (the process host). It is not implied that the agent’s localhost is the user’s Editor.

- Default `http://127.0.0.1:30010` works only when the process host and the Editor host are the same machine. That address is the process’s loopback.
- If the process host and the Editor host differ, set `UE_REMOTE_CONTROL_URL` to an address the process host can route to. On the Editor, bind the HTTP server beyond loopback — `[HTTPServer.Listeners]` `DefaultBindAddress=0.0.0.0` or the machine IP, in project or engine config — and allow TCP 30010 from the process host through the firewall. Do not expose Remote Control to the public internet.
- An SSH local forward or a VPN is a valid general pattern: point `UE_REMOTE_CONTROL_URL` at the forwarded address. Loopback then means the tunnel you configured, not an Editor discovered by magic.
- If no network path exists, run the `ue-tools` CLI on the Editor machine itself (a shell on that host). Some agent executors cannot target another machine; the parent agent must run Editor commands on the Editor host.

### Setup (any Unreal user)

1. Enable the **Remote Control API** plugin in your project.
2. In the Editor console, run `WebControl.StartServer`. The HTTP server listens at **`http://127.0.0.1:30010`** on the Editor host by default.
3. Optional: `WebControl.EnableServerOnStartup` so the server starts with the Editor.
4. Optional, for `editor console` / `editor highresshot`: allow remote console execution in Remote Control settings (`bAllowConsoleCommandRemoteExecution`).
5. If the process that calls Remote Control is not on the Editor host, set `UE_REMOTE_CONTROL_URL` as described above.

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

# Editor (Remote Control HTTP reached from this process)
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

`editor console` always includes `command`, `url`, `via` (`PUT /remote/object/call` on `KismetSystemLibrary.ExecuteConsoleCommand`), `httpStatus` when the HTTP response arrived, and `raw` (the JSON body; `result` is the same value). `ExecuteConsoleCommand` has no output parameter, so Remote Control often returns `{}` or an empty `ReturnValue`. That is not console stdout. Check the Editor Output Log on the Editor host. HTTP success is not proof that `LiveCoding.Compile` compiled successfully. Epic’s Remote Control HTTP reference does not document an Output Log route; this package does not scrape one.

`editor actors list` and `editor select` call `GetAllLevelActors` / `GetSelectedLevelActors` on `EditorActorSubsystem` first, then `EditorLevelLibrary` (the object path in Epic’s HTTP reference; the library is deprecated in favor of the subsystem). That reference does not document another actor-list route.

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
