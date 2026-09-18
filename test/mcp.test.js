import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("mcp stdio lists tools and fixture search", async () => {
  const env = { ...process.env, UE_FIXTURE: "1" };
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, "dist", "mcp.js")],
    cwd: root,
    env,
    stderr: "pipe",
  });
  const client = new Client({ name: "ue-tools-test", version: "0.3.0" });
  await client.connect(transport);
  try {
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, [
      "ue_editor_actors_list",
      "ue_editor_console",
      "ue_editor_highresshot",
      "ue_editor_object_describe",
      "ue_editor_object_get",
      "ue_editor_object_set",
      "ue_editor_screenshot",
      "ue_editor_select",
      "ue_editor_status",
      "ue_file_get",
      "ue_history",
      "ue_modules_list",
      "ue_search",
      "ue_status",
      "ue_symbol",
      "ue_tree",
    ]);

    const search = await client.callTool({
      name: "ue_search",
      arguments: { query: "Core", path: "Engine/Source/Runtime", extension: "h" },
    });
    assert.equal(search.isError, undefined);
    const text = search.content[0].text;
    const body = JSON.parse(text);
    assert.ok(body.total >= 1);
    assert.ok(body.hits.some((hit) => hit.path.includes("CoreMinimal.h")));
    assert.ok(body.hits.every((hit) => hit.path.endsWith(".h")));

    const symbol = await client.callTool({ name: "ue_symbol", arguments: { name: "FName" } });
    assert.equal(symbol.isError, undefined);
    const symbolBody = JSON.parse(symbol.content[0].text);
    assert.ok(symbolBody.hits.some((hit) => hit.path.includes("CoreMinimal.h")));

    const history = await client.callTool({
      name: "ue_history",
      arguments: { path: "Engine/Source/Runtime/Core/Public/CoreMinimal.h", limit: 2 },
    });
    assert.equal(history.isError, undefined);
    const historyBody = JSON.parse(history.content[0].text);
    assert.equal(historyBody.lineBlame, false);
    assert.ok(historyBody.commits.length >= 1);

    const editor = await client.callTool({ name: "ue_editor_actors_list", arguments: { name: "Floor" } });
    assert.equal(editor.isError, undefined);
    const actors = JSON.parse(editor.content[0].text);
    assert.ok(actors.actors.some((actor) => actor.name === "Floor"));

    const denied = await client.callTool({
      name: "ue_editor_object_set",
      arguments: {
        objectPath: "/Game/Maps/FixtureMap.FixtureMap:PersistentLevel.Floor",
        propertyName: "bHidden",
        propertyValue: true,
        confirm: false,
      },
    });
    assert.equal(denied.isError, true);
    assert.match(denied.content[0].text, /confirm_required/);

    const select = await client.callTool({ name: "ue_editor_select", arguments: {} });
    assert.equal(select.isError, undefined);
    const selected = JSON.parse(select.content[0].text);
    assert.ok(selected.actors.some((actor) => actor.name === "PlayerStart_0"));

    const shot = await client.callTool({ name: "ue_editor_screenshot", arguments: {} });
    assert.equal(shot.isError, undefined);
    const shotBody = JSON.parse(shot.content[0].text);
    assert.equal(shotBody.available, false);
    assert.equal(shotBody.thumbnailRoute, "/remote/object/thumbnail");
    assert.match(shotBody.reason, /no viewport-capture/);

    const highres = await client.callTool({ name: "ue_editor_highresshot", arguments: {} });
    assert.equal(highres.isError, undefined);
    const highresBody = JSON.parse(highres.content[0].text);
    assert.equal(highresBody.command, "HighResShot");
    assert.equal(highresBody.imageReturned, false);
  } finally {
    await client.close();
  }
});
