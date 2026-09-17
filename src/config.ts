import path from "node:path";
import { fileURLToPath } from "node:url";
import { UeToolsError, type SourceKind } from "./types.js";

const DEFAULT_OWNER = "EpicGames";
const DEFAULT_REPO = "UnrealEngine";
const DEFAULT_REF = "release";
export const DEFAULT_REMOTE_CONTROL_URL = "http://127.0.0.1:30010";
const DEFAULT_REMOTE_CONTROL_TIMEOUT_MS = 5000;

export type ToolConfig = {
  owner: string;
  repo: string;
  ref: string;
  fixture: boolean;
  token: string | null;
};

export type EditorConfig = {
  fixture: boolean;
  remoteControlUrl: string;
  timeoutMs: number;
};

export type ArgFlags = {
  fixture?: boolean;
  ref?: string;
  url?: string;
};

export function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

export function fixtureRoot(): string {
  return path.join(packageRoot(), "fixtures", "ue-src");
}

export function loadConfig(flags: ArgFlags = {}): ToolConfig {
  const fixture = isFixture(flags);
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
      "Set GITHUB_TOKEN or GH_TOKEN (GitHub PAT with access to the configured Unreal Engine repo; default EpicGames/UnrealEngine).",
    );
  }
  return cfg.token;
}

export function isFixture(flags: ArgFlags = {}): boolean {
  return (
    Boolean(flags.fixture) ||
    process.env.UE_FIXTURE === "1" ||
    process.env.UE_FIXTURE === "true"
  );
}

export function loadEditorConfig(flags: ArgFlags = {}): EditorConfig {
  const timeoutRaw = firstNonEmpty(process.env.UE_REMOTE_CONTROL_TIMEOUT_MS);
  const timeoutMs = timeoutRaw ? Number(timeoutRaw) : DEFAULT_REMOTE_CONTROL_TIMEOUT_MS;
  return {
    fixture: isFixture(flags),
    remoteControlUrl: stripTrailingSlash(
      flags.url || firstNonEmpty(process.env.UE_REMOTE_CONTROL_URL) || DEFAULT_REMOTE_CONTROL_URL,
    ),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_REMOTE_CONTROL_TIMEOUT_MS,
  };
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function firstNonEmpty(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim()) return value.trim();
  }
  return null;
}
