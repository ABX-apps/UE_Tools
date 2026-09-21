import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PRODUCT_COPY = [
  "README.md",
  "CHANGELOG.md",
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
    assert.doesNotMatch(text, /\bMini\b/, rel);
    assert.doesNotMatch(text, /Logistics/i, rel);
    assert.doesNotMatch(text, /Abraham/i, rel);
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

test("README and editor skill distinguish process host from Editor host", () => {
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  const skill = fs.readFileSync(path.join(root, "skills/ue-editor/SKILL.md"), "utf8");
  for (const [rel, text] of [
    ["README.md", readme],
    ["skills/ue-editor/SKILL.md", skill],
  ]) {
    assert.match(text, /process host/, rel);
    assert.match(text, /Editor host/, rel);
    assert.match(text, /UE_REMOTE_CONTROL_URL/, rel);
    assert.match(text, /127\.0\.0\.1:30010/, rel);
    assert.match(text, /editor_unreachable/, rel);
    assert.match(text, /DefaultBindAddress=0\.0\.0\.0/, rel);
    assert.match(text, /TCP 30010/, rel);
    assert.doesNotMatch(text, /Mac Mini|Logistics|Abraham/i, rel);
  }
  assert.match(skill, /UE_FIXTURE=1/);
  assert.match(skill, /different machine than the Unreal Editor/);
});

test("local install names the package root and warns about a nested clone", () => {
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.name, "ue-tools");
  assert.equal(pkg.bin["ue-tools"], "./dist/cli.js");
  assert.equal(pkg.bin["ue-src"], "./dist/cli.js");
  assert.match(readme, /directory that contains `package\.json`/);
  assert.match(readme, /node dist\/cli\.js/);
  assert.match(readme, /npx --prefix \. ue-tools/);
  assert.match(readme, /UE_Tools\/UE_Tools/);
});

test("screenshot gap is documented without inventing a viewport HTTP route", () => {
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  const domain = fs.readFileSync(path.join(root, "DOMAIN.md"), "utf8");
  const skill = fs.readFileSync(path.join(root, "skills/ue-editor/SKILL.md"), "utf8");
  for (const text of [readme, domain, skill]) {
    assert.match(text, /viewport-capture HTTP route|no capture route|asset thumbs|asset thumbnails/i);
    assert.doesNotMatch(text, /\/remote\/viewport/);
    assert.doesNotMatch(text, /\/remote\/screenshot/);
  }
});
