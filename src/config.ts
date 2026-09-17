import path from "node:path";
import { fileURLToPath } from "node:url";
import { UeToolsError, type SourceKind } from "./types.js";

const DEFAULT_OWNER = "ABX-apps";
const DEFAULT_REPO = "UnrealEngine";
const DEFAULT_REF = "release";

export type ToolConfig = {
  owner: string;
  repo: string;
  ref: string;
  fixture: boolean;
  token: string | null;
};

export type ArgFlags = {
  fixture?: boolean;
  ref?: string;
};

export function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

export function fixtureRoot(): string {
  return path.join(packageRoot(), "fixtures", "ue-src");
}

export function loadConfig(flags: ArgFlags = {}): ToolConfig {
  const fixture =
    Boolean(flags.fixture) ||
    process.env.UE_FIXTURE === "1" ||
    process.env.UE_FIXTURE === "true";
  const token = firstNonEmpty(process.env.GITHUB_TOKEN, process.env.GH_TOKEN);
  return {
    owner: firstNonEmpty(process.env.UE_OWNER) ?? DEFAULT_OWNER,
    repo: firstNonEmpty(process.env.UE_REPO) ?? DEFAULT_REPO,
    ref: flags.ref || firstNonEmpty(process.env.UE_REF) || DEFAULT_REF,
    fixture,
    token,
  };
}

export function sourceKind(cfg: ToolConfig): SourceKind {
  return cfg.fixture ? "fixture" : "github";
}

export function requireToken(cfg: ToolConfig): string {
  if (cfg.fixture) return "";
  if (!cfg.token) {
    throw new UeToolsError(
      "missing_token",
      "Set GITHUB_TOKEN or GH_TOKEN (GitHub PAT with repo scope for ABX-apps/UnrealEngine).",
    );
  }
  return cfg.token;
}

function firstNonEmpty(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim()) return value.trim();
  }
  return null;
}
