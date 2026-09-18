import { loadConfig, requireToken, sourceKind, type ToolConfig } from "./config.js";
import { createFixtureClient } from "./fixture.js";
import { buildSearchQuery, createGitHubClient, extractSearchFilters } from "./github.js";
import { normalizeRepoPath } from "./paths.js";
import {
  EDITOR_MODULES_PATH,
  RUNTIME_MODULES_PATH,
  UeToolsError,
  type FileResult,
  type HistoryResult,
  type ModulesResult,
  type SearchFilters,
  type SearchHit,
  type SearchResult,
  type StatusResult,
  type SymbolHit,
  type SymbolKind,
  type SymbolResult,
  type TreeResult,
} from "./types.js";

export type SourceBackend = {
  searchCode(
    query: string,
    filters?: SearchFilters,
  ): Promise<{ total: number; incomplete: boolean; hits: SearchResult["hits"] }>;
  getFile(path: string, ref: string): Promise<{ sha?: string; size: number; content: string }>;
  listTree(path: string, ref: string): Promise<TreeResult["entries"]>;
  listCommits(path: string, ref: string, limit: number): Promise<HistoryResult["commits"]>;
};

const HISTORY_NOTE =
  "Lightweight file history via GitHub commits API (last N commits touching this path). Not line-level blame; no clone.";

export function createBackend(cfg: ToolConfig): SourceBackend {
  if (cfg.fixture) return createFixtureClient();
  return createGitHubClient(cfg.owner, cfg.repo, requireToken(cfg));
}

export function status(cfg: ToolConfig = loadConfig()): StatusResult {
  return {
    owner: cfg.owner,
    repo: cfg.repo,
    ref: cfg.ref,
    source: sourceKind(cfg),
    tokenConfigured: Boolean(cfg.token),
  };
}

export async function search(
  query: string,
  cfg: ToolConfig = loadConfig(),
  filters: SearchFilters = {},
): Promise<SearchResult> {
  const q = query.trim();
  if (!q) {
    throw new UeToolsError("invalid_query", "search requires a query string.");
  }
  const backend = createBackend(cfg);
  const result = await backend.searchCode(q, filters);
  return {
    query: cfg.fixture ? displayQuery(q, cfg, filters) : buildSearchQuery(q, cfg.owner, cfg.repo, filters),
    repo: `${cfg.owner}/${cfg.repo}`,
    total: result.total,
    incomplete: result.incomplete,
    hits: result.hits,
  };
}

export async function findSymbol(name: string, cfg: ToolConfig = loadConfig()): Promise<SymbolResult> {
  const ident = name.trim();
  if (!ident) {
    throw new UeToolsError("invalid_query", "symbol requires a class or type name.");
  }
  const query = symbolSearchQuery(ident);
  const backend = createBackend(cfg);
  const liveQuery = cfg.fixture ? ident : query.query;
  let result = await backend.searchCode(liveQuery, query.filters);
  if (result.hits.length === 0) {
    result = await backend.searchCode(ident, {});
  }
  const hits = result.hits
    .map((hit) => rankSymbolHit(ident, hit))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 10);
  return {
    name: ident,
    query: cfg.fixture ? `${ident} extension:h` : buildSearchQuery(query.query, cfg.owner, cfg.repo, query.filters),
    repo: `${cfg.owner}/${cfg.repo}`,
    hits,
  };
}

export async function fileHistory(
  repoPath: string,
  cfg: ToolConfig = loadConfig(),
  limit = 10,
): Promise<HistoryResult> {
  const path = normalizeRepoPath(repoPath);
  if (!path) {
    throw new UeToolsError("invalid_path", "history requires a file path.");
  }
  const perPage = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 100) : 10;
  const backend = createBackend(cfg);
  const commits = await backend.listCommits(path, cfg.ref, perPage);
  return {
    path,
    ref: cfg.ref,
    repo: `${cfg.owner}/${cfg.repo}`,
    source: sourceKind(cfg),
    note: HISTORY_NOTE,
    lineBlame: false,
    commits,
  };
}

export async function fileGet(repoPath: string, cfg: ToolConfig = loadConfig()): Promise<FileResult> {
  const path = normalizeRepoPath(repoPath);
  if (!path) {
    throw new UeToolsError("invalid_path", "file get requires a file path.");
  }
  const backend = createBackend(cfg);
  const file = await backend.getFile(path, cfg.ref);
  return {
    path,
    ref: cfg.ref,
    sha: file.sha,
    size: file.size,
    encoding: "utf-8",
    content: file.content,
  };
}

export async function tree(repoPath: string | undefined, cfg: ToolConfig = loadConfig()): Promise<TreeResult> {
  const path = normalizeRepoPath(repoPath);
  const backend = createBackend(cfg);
  const entries = await backend.listTree(path, cfg.ref);
  return { path, ref: cfg.ref, entries };
}

export async function modulesList(cfg: ToolConfig = loadConfig()): Promise<ModulesResult> {
  const backend = createBackend(cfg);
  const [runtime, editor] = await Promise.all([
    backend.listTree(RUNTIME_MODULES_PATH, cfg.ref),
    backend.listTree(EDITOR_MODULES_PATH, cfg.ref),
  ]);
  return {
    ref: cfg.ref,
    modules: [
      ...runtime
        .filter((entry) => entry.type === "dir")
        .map((entry) => ({ name: entry.name, layer: "Runtime" as const, path: entry.path })),
      ...editor
        .filter((entry) => entry.type === "dir")
        .map((entry) => ({ name: entry.name, layer: "Editor" as const, path: entry.path })),
    ],
  };
}

export function symbolSearchQuery(name: string): { query: string; filters: SearchFilters } {
  return {
    query: `${name} (UCLASS OR "class ${name}" OR "struct ${name}")`,
    filters: { extension: "h" },
  };
}

export function rankSymbolHit(name: string, hit: SearchHit): SymbolHit {
  const ident = escapeRegExp(name);
  const haystack = `${hit.path}\n${hit.snippet ?? ""}\n${hit.textMatches.map((m) => m.fragment).join("\n")}`;
  const isHeader = /\.(h|hh|hpp|hxx)$/i.test(hit.path);
  let kind: SymbolKind = "other";
  let score = 0;
  if (isHeader) score += 8;
  if (new RegExp(String.raw`\bUCLASS\s*\(`, "i").test(haystack)) {
    kind = "uclass";
    score += 12;
  }
  if (new RegExp(String.raw`\bclass\s+(?:\w+\s+)*${ident}\b`).test(haystack)) {
    kind = kind === "uclass" ? "uclass" : "class";
    score += 20;
  } else if (new RegExp(String.raw`\bstruct\s+(?:\w+\s+)*${ident}\b`).test(haystack)) {
    kind = "struct";
    score += 16;
  }
  const base = hit.path.split("/").pop() ?? "";
  if (base.toLowerCase() === `${name.toLowerCase()}.h` || base.toLowerCase() === `${name.toLowerCase()}.hpp`) {
    score += 6;
  }
  if (/\/Public\//.test(hit.path) || /\/Classes\//.test(hit.path)) score += 3;
  if (kind === "other" && isHeader) kind = "header";
  return { ...hit, kind, score };
}

function displayQuery(query: string, cfg: ToolConfig, filters: SearchFilters): string {
  const extracted = extractSearchFilters(query);
  return [extracted.needle || query.trim(), filters.path && `path:${filters.path}`, filters.language && `language:${filters.language}`, filters.extension && `extension:${filters.extension}`, `repo:${cfg.owner}/${cfg.repo}`]
    .filter(Boolean)
    .join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
