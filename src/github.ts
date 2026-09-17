import { UeToolsError, type SearchHit, type TextMatch, type TreeEntry } from "./types.js";

const API = "https://api.github.com";
const API_VERSION = "2022-11-28";
const USER_AGENT = "ABX-apps-ue-tools";

export type GitHubClient = {
  searchCode(query: string): Promise<{ total: number; incomplete: boolean; hits: SearchHit[] }>;
  getFile(path: string, ref: string): Promise<{ sha?: string; size: number; content: string }>;
  listTree(path: string, ref: string): Promise<TreeEntry[]>;
};

export function createGitHubClient(owner: string, repo: string, token: string): GitHubClient {
  return {
    async searchCode(query: string) {
      const q = scopeSearchQuery(query, owner, repo);
      const data = await githubJson<GitHubSearchResponse>(
        `/search/code?q=${encodeURIComponent(q)}&per_page=20`,
        token,
        "application/vnd.github.text-match+json",
      );
      return {
        total: data.total_count ?? data.items.length,
        incomplete: Boolean(data.incomplete_results),
        hits: (data.items ?? []).map(mapSearchHit),
      };
    },

    async getFile(path: string, ref: string) {
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

    async listTree(path: string, ref: string) {
      const data = await githubJson<GitHubContent | GitHubContent[]>(
        contentsUrl(owner, repo, path, ref),
        token,
      );
      if (!Array.isArray(data)) {
        throw new UeToolsError("not_directory", `Not a directory: ${path || "/"}. Use file get.`);
      }
      return data.map(mapTreeEntry);
    },
  };
}

export function scopeSearchQuery(query: string, owner: string, repo: string): string {
  const stripped = query.replace(/\brepo:\S+/g, "").trim();
  return `${stripped} repo:${owner}/${repo}`.trim();
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

function mapSearchHit(item: GitHubSearchItem): SearchHit {
  const matches: TextMatch[] = (item.text_matches ?? []).map((match) => ({
    fragment: match.fragment ?? "",
    property: match.property,
  }));
  return {
    path: item.path,
    name: item.name,
    sha: item.sha,
    htmlUrl: item.html_url,
    textMatches: matches,
  };
}

function mapTreeEntry(item: GitHubContent): TreeEntry {
  return {
    name: item.name,
    path: item.path,
    type: item.type === "dir" ? "dir" : "file",
    size: item.type === "file" ? item.size : undefined,
  };
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
