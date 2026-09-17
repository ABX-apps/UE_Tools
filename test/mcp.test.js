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
  const client = new Client({ name: "ue-tools-test", version: "0.1.0" });
  await client.connect(transport);
  try {
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, ["ue_file_get", "ue_modules_list", "ue_search", "ue_status", "ue_tree"]);

    const search = await client.callTool({ name: "ue_search", arguments: { query: "Core" } });
    assert.equal(search.isError, undefined);
    const text = search.content[0].text;
    const body = JSON.parse(text);
    assert.ok(body.total >= 1);
    assert.ok(body.hits.some((hit) => hit.path.includes("CoreMinimal.h")));
  } finally {
    await client.close();
  }
});
