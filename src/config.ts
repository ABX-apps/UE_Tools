import path from "node:path";
import { fileURLToPath } from "node:url";
import { UeToolsError, type SourceKind } from "./types.js";

const DEFAULT_OWNER = "EpicGames";
const DEFAULT_REPO = "UnrealEngine";
const DEFAULT_REF = "release";
export const DEFAULT_REMOTE_CONTROL_URL = "http://127.0.0.1:30010";
const DEFAULT_REMOTE_CONTROL_TIMEOUT_MS = 5000;
const UNEXPANDED_PLACEHOLDER = /^\$\{[A-Z][A-Z0-9_]*\}$/;

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
  path?: string;
  language?: string;
  extension?: string;
  name?: string;
  class?: string;
  limit?: number;
  confirm?: boolean;
  transaction?: boolean;
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
    remoteControlUrl: normalizeRemoteControlUrl(
      flags.url || firstNonEmpty(process.env.UE_REMOTE_CONTROL_URL) || DEFAULT_REMOTE_CONTROL_URL,
    ),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_REMOTE_CONTROL_TIMEOUT_MS,
  };
}

export function normalizeRemoteControlUrl(url: string): string {
  const trimmed = stripTrailingSlash(url.trim());
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new UeToolsError(
      "usage",
      `Invalid Remote Control URL ${url}. Use an http(s) Web Remote Control base URL (default ${DEFAULT_REMOTE_CONTROL_URL}).`,
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UeToolsError(
      "usage",
      `Remote Control URL must be http(s) (default ${DEFAULT_REMOTE_CONTROL_URL}). Other Unreal services (for example Zen) on other ports are not Remote Control.`,
    );
  }
  return trimmed;
}

export function requireConfirm(confirm: boolean | undefined, action: string): void {
  if (!confirm) {
    throw new UeToolsError(
      "confirm_required",
      `${action} is mutating. Pass --confirm (CLI) or confirm=true (MCP) to proceed.`,
    );
  }
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Treat unset, blank, and unexpanded `${VAR}` plugin placeholders as missing. */
export function firstNonEmpty(...values: Array<string | undefined | null>): string | null {
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed || UNEXPANDED_PLACEHOLDER.test(trimmed)) continue;
    return trimmed;
  }
  return null;
}
