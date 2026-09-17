import { loadConfig, requireToken, sourceKind, type ToolConfig } from "./config.js";
import { createFixtureClient } from "./fixture.js";
import { createGitHubClient, scopeSearchQuery } from "./github.js";
import { normalizeRepoPath } from "./paths.js";
import {
  EDITOR_MODULES_PATH,
  RUNTIME_MODULES_PATH,
  UeToolsError,
  type FileResult,
  type ModulesResult,
  type SearchResult,
  type StatusResult,
  type TreeResult,
} from "./types.js";

export type SourceBackend = {
  searchCode(query: string): Promise<{ total: number; incomplete: boolean; hits: SearchResult["hits"] }>;
  getFile(path: string, ref: string): Promise<{ sha?: string; size: number; content: string }>;
  listTree(path: string, ref: string): Promise<TreeResult["entries"]>;
};

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

export async function search(query: string, cfg: ToolConfig = loadConfig()): Promise<SearchResult> {
  const q = query.trim();
  if (!q) {
    throw new UeToolsError("invalid_query", "search requires a query string.");
  }
  const backend = createBackend(cfg);
  const result = await backend.searchCode(q);
  return {
    query: cfg.fixture ? q : scopeSearchQuery(q, cfg.owner, cfg.repo),
    repo: `${cfg.owner}/${cfg.repo}`,
    total: result.total,
    incomplete: result.incomplete,
    hits: result.hits,
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
