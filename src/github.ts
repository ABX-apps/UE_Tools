import { normalizeRepoPath } from "./paths.js";
import {
  UeToolsError,
  type FileCommit,
  type SearchFilters,
  type SearchHit,
  type TextMatch,
  type TreeEntry,
} from "./types.js";

const API = "https://api.github.com";
const API_VERSION = "2022-11-28";
const USER_AGENT = "ue-tools";

export type GitHubClient = {
  searchCode(
    query: string,
    filters?: SearchFilters,
  ): Promise<{ total: number; incomplete: boolean; hits: SearchHit[] }>;
  getFile(path: string, ref: string): Promise<{ sha?: string; size: number; content: string }>;
  listTree(path: string, ref: string): Promise<TreeEntry[]>;
  listCommits(path: string, ref: string, limit: number): Promise<FileCommit[]>;
};

export function createGitHubClient(owner: string, repo: string, token: string): GitHubClient {
  const repoSlug = `${owner}/${repo}`;
  return {
    async searchCode(query, filters = {}) {
      const q = buildSearchQuery(query, owner, repo, filters);
      const data = await githubJson<GitHubSearchResponse>(
        `/search/code?q=${encodeURIComponent(q)}&per_page=20`,
        token,
        "application/vnd.github.text-match+json",
      );
      return {
        total: data.total_count ?? data.items.length,
        incomplete: Boolean(data.incomplete_results),
        hits: (data.items ?? []).map((item) => mapSearchHit(item, repoSlug)),
      };
    },

    async getFile(path, ref) {
      const data = await githubJson<GitHubContent>(contentsUrl(owner, repo, path, ref), token);
      if (Array.isArray(data) || data.type === "dir") {
        throw new UeToolsError("is_directory", `Not a file: ${path || "/"}. Use tree.`);
      }
      if (data.encoding !== "base64" || typeof data.content !== "string") {
        throw new UeToolsError(
          "file_unavailable",
          `Cannot read ${path || "/"} at ${ref} (too large or not text).`,
        );
      }
      const buf = Buffer.from(data.content.replace(/\n/g, ""), "base64");
      return {
        sha: data.sha,
        size: data.size ?? buf.length,
        content: buf.toString("utf8"),
      };
    },

    async listTree(path, ref) {
      const data = await githubJson<GitHubContent | GitHubContent[]>(
        contentsUrl(owner, repo, path, ref),
        token,
      );
      if (!Array.isArray(data)) {
        throw new UeToolsError("not_directory", `Not a directory: ${path || "/"}. Use file get.`);
      }
      return data.map(mapTreeEntry);
    },

    async listCommits(path, ref, limit) {
      const perPage = Math.min(Math.max(limit, 1), 100);
      const data = await githubJson<GitHubCommit[]>(
        `/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(ref)}&per_page=${perPage}`,
        token,
      );
      return (Array.isArray(data) ? data : []).map(mapCommit);
    },
  };
}

export function scopeSearchQuery(query: string, owner: string, repo: string): string {
  return buildSearchQuery(query, owner, repo, {});
}

export function buildSearchQuery(
  query: string,
  owner: string,
  repo: string,
  filters: SearchFilters = {},
): string {
  const extracted = extractSearchFilters(query);
  const pathFilter = first(filters.path, extracted.filters.path);
  const language = first(filters.language, extracted.filters.language);
  const extension = first(filters.extension, extracted.filters.extension);
  const parts = [extracted.needle];
  if (pathFilter) parts.push(`path:${normalizeRepoPath(pathFilter)}`);
  if (language) parts.push(`language:${language}`);
  if (extension) parts.push(`extension:${extension.replace(/^\./, "")}`);
  parts.push(`repo:${owner}/${repo}`);
  return parts.filter(Boolean).join(" ").trim();
}

export function extractSearchFilters(query: string): { needle: string; filters: SearchFilters } {
  const filters: SearchFilters = {};
  let needle = query.replace(/\brepo:\S+/gi, " ");
  needle = needle.replace(/\bpath:(\S+)/gi, (_, value: string) => {
    filters.path = value;
    return " ";
  });
  needle = needle.replace(/\blanguage:(\S+)/gi, (_, value: string) => {
    filters.language = value;
    return " ";
  });
  needle = needle.replace(/\bextension:(\S+)/gi, (_, value: string) => {
    filters.extension = value.replace(/^\./, "");
    return " ";
  });
  return { needle: needle.replace(/\s+/g, " ").trim(), filters };
}

export function shapeSearchHit(
  hit: Omit<SearchHit, "repo" | "snippet"> & { repo?: string; snippet?: string },
  repo: string,
): SearchHit {
  const snippet =
    hit.snippet ?? hit.textMatches.find((match) => match.fragment)?.fragment ?? undefined;
  return {
    path: hit.path,
    name: hit.name,
    repo,
    snippet,
    sha: hit.sha,
    htmlUrl: hit.htmlUrl,
    textMatches: hit.textMatches,
  };
}

function contentsUrl(owner: string, repo: string, repoPath: string, ref: string): string {
  const encoded = repoPath
    ? repoPath
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/")
    : "";
  const base = encoded
    ? `/repos/${owner}/${repo}/contents/${encoded}`
    : `/repos/${owner}/${repo}/contents`;
  return `${base}?ref=${encodeURIComponent(ref)}`;
}

async function githubJson<T>(apiPath: string, token: string, accept = "application/vnd.github+json"): Promise<T> {
  const res = await fetch(`${API}${apiPath}`, {
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": API_VERSION,
      "User-Agent": USER_AGENT,
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text };
  }
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : `GitHub API ${res.status}`;
    throw new UeToolsError("github_error", message, res.status);
  }
  return body as T;
}

function mapSearchHit(item: GitHubSearchItem, repo: string): SearchHit {
  const matches: TextMatch[] = (item.text_matches ?? []).map((match) => ({
    fragment: match.fragment ?? "",
    property: match.property,
  }));
  return shapeSearchHit(
    {
      path: item.path,
      name: item.name,
      sha: item.sha,
      htmlUrl: item.html_url,
      textMatches: matches,
    },
    repo,
  );
}

function mapTreeEntry(item: GitHubContent): TreeEntry {
  return {
    name: item.name,
    path: item.path,
    type: item.type === "dir" ? "dir" : "file",
    size: item.type === "file" ? item.size : undefined,
  };
}

function mapCommit(item: GitHubCommit): FileCommit {
  const message = item.commit?.message ?? "";
  return {
    sha: item.sha,
    message: message.split("\n")[0] ?? message,
    author: item.commit?.author?.name ?? item.author?.login,
    date: item.commit?.author?.date ?? item.commit?.committer?.date,
    htmlUrl: item.html_url,
  };
}

function first(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

type GitHubSearchResponse = {
  total_count?: number;
  incomplete_results?: boolean;
  items: GitHubSearchItem[];
};

type GitHubSearchItem = {
  name: string;
  path: string;
  sha?: string;
  html_url?: string;
  text_matches?: Array<{ fragment?: string; property?: string }>;
};

type GitHubContent = {
  name: string;
  path: string;
  sha?: string;
  size?: number;
  type?: string;
  encoding?: string;
  content?: string;
};

type GitHubCommit = {
  sha: string;
  html_url?: string;
  author?: { login?: string };
  commit?: {
    message?: string;
    author?: { name?: string; date?: string };
    committer?: { name?: string; date?: string };
  };
};
