import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PRODUCT_COPY = [
  "README.md",
  "MARKETPLACE.md",
  "DOMAIN.md",
  ".env.example",
  "src/cli.ts",
  "src/remoteControl.ts",
  "src/mcp.ts",
  "skills/ue-editor/SKILL.md",
  "skills/ue-source/SKILL.md",
];

function readProductCopy() {
  return PRODUCT_COPY.map((rel) => ({ rel, text: fs.readFileSync(path.join(root, rel), "utf8") }));
}

test("product copy stays generic for any Unreal user", () => {
  const files = readProductCopy();
  for (const { rel, text } of files) {
    assert.doesNotMatch(text, /Grok Bot/i, rel);
    assert.doesNotMatch(text, /Mac Mini/i, rel);
    assert.doesNotMatch(text, /Logistics\.uproject/i, rel);
    assert.doesNotMatch(text, /UE_OWNER=ABX-apps/);
    assert.doesNotMatch(text, /for example `ABX-apps`/);
  }

  const joined = files.map((file) => file.text).join("\n");
  assert.match(joined, /WebControl\.StartServer/);
  assert.match(joined, /WebControl\.EnableServerOnStartup/);
  assert.match(joined, /UE_REMOTE_CONTROL_URL/);
  assert.match(joined, /Zen/);
  assert.match(joined, /\/remote\/object\/thumbnail/);
  assert.match(joined, /HighResShot/);
  assert.match(joined, /editor_unreachable/);
  assert.match(joined, /confirm/);
});

test("screenshot gap is documented without inventing a viewport HTTP route", () => {
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  const domain = fs.readFileSync(path.join(root, "DOMAIN.md"), "utf8");
  const skill = fs.readFileSync(path.join(root, "skills/ue-editor/SKILL.md"), "utf8");
  for (const text of [readme, domain, skill]) {
    assert.match(text, /no viewport-capture HTTP route|no capture route|asset thumbs/i);
    assert.doesNotMatch(text, /\/remote\/viewport/);
    assert.doesNotMatch(text, /\/remote\/screenshot/);
  }
});
