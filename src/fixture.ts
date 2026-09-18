import fs from "node:fs";
import path from "node:path";
import { fixtureRoot } from "./config.js";
import { extractSearchFilters, shapeSearchHit } from "./github.js";
import { normalizeRepoPath } from "./paths.js";
import {
  UeToolsError,
  type FileCommit,
  type SearchFilters,
  type SearchHit,
  type TreeEntry,
} from "./types.js";

const FIXTURE_REPO = "EpicGames/UnrealEngine";

const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  "c++": ["h", "hh", "hpp", "hxx", "cpp", "cc", "cxx", "inl", "ipp"],
  cpp: ["h", "hh", "hpp", "hxx", "cpp", "cc", "cxx", "inl", "ipp"],
  "c#": ["cs"],
  csharp: ["cs"],
  c: ["c", "h"],
};

export type FixtureClient = {
  searchCode(
    query: string,
    filters?: SearchFilters,
  ): Promise<{ total: number; incomplete: boolean; hits: SearchHit[] }>;
  getFile(repoPath: string, ref: string): Promise<{ sha?: string; size: number; content: string }>;
  listTree(repoPath: string, ref: string): Promise<TreeEntry[]>;
  listCommits(path: string, ref: string, limit: number): Promise<FileCommit[]>;
};

export function createFixtureClient(): FixtureClient {
  const root = fixtureRoot();
  return {
    async searchCode(query, filters = {}) {
      const extracted = extractSearchFilters(query);
      const merged: SearchFilters = {
        path: filters.path || extracted.filters.path,
        language: filters.language || extracted.filters.language,
        extension: filters.extension || extracted.filters.extension,
      };
      const needle = extracted.needle.toLowerCase();
      const files = walkFiles(root, "");
      const hits: SearchHit[] = [];
      for (const file of files) {
        if (!matchesFilters(file, merged)) continue;
        const abs = path.join(root, file);
        const content = fs.readFileSync(abs, "utf8");
        const haystack = `${file}\n${content}`.toLowerCase();
        if (!needle || haystack.includes(needle)) {
          const lines = content.split("\n");
          const idx = needle
            ? lines.findIndex((row) => row.toLowerCase().includes(needle))
            : lines.findIndex((row) => row.trim());
          const fragment =
            idx >= 0
              ? lines
                  .slice(Math.max(0, idx - 2), idx + 3)
                  .map((row) => row.trim())
                  .filter(Boolean)
                  .join(" ")
              : undefined;
          hits.push(
            shapeSearchHit(
              {
                path: file,
                name: path.posix.basename(file),
                textMatches: fragment ? [{ fragment, property: "content" }] : [],
              },
              FIXTURE_REPO,
            ),
          );
        }
      }
      return { total: hits.length, incomplete: false, hits };
    },

    async getFile(repoPath) {
      const rel = normalizeRepoPath(repoPath);
      const abs = resolveInside(root, rel);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(abs);
      } catch {
        throw new UeToolsError("not_found", `File not found: ${rel || "/"}`);
      }
      if (stat.isDirectory()) {
        throw new UeToolsError("is_directory", `Not a file: ${rel || "/"}. Use tree.`);
      }
      const content = fs.readFileSync(abs, "utf8");
      return { size: stat.size, content };
    },

    async listTree(repoPath) {
      const rel = normalizeRepoPath(repoPath);
      const abs = resolveInside(root, rel);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(abs);
      } catch {
        throw new UeToolsError("not_found", `Path not found: ${rel || "/"}`);
      }
      if (!stat.isDirectory()) {
        throw new UeToolsError("not_directory", `Not a directory: ${rel || "/"}. Use file get.`);
      }
      const names = fs.readdirSync(abs).sort((a, b) => a.localeCompare(b));
      return names.map((name) => {
        const childRel = rel ? `${rel}/${name}` : name;
        const childStat = fs.statSync(path.join(abs, name));
        return {
          name,
          path: childRel,
          type: childStat.isDirectory() ? "dir" : "file",
          size: childStat.isDirectory() ? undefined : childStat.size,
        } satisfies TreeEntry;
      });
    },

    async listCommits(repoPath, ref, limit) {
      const rel = normalizeRepoPath(repoPath);
      if (!rel) {
        throw new UeToolsError("invalid_path", "history requires a file path.");
      }
      const abs = resolveInside(root, rel);
      try {
        const stat = fs.statSync(abs);
        if (stat.isDirectory()) {
          throw new UeToolsError("is_directory", `Not a file: ${rel}. history is per-path commits.`);
        }
      } catch (err) {
        if (err instanceof UeToolsError) throw err;
        throw new UeToolsError("not_found", `File not found: ${rel}`);
      }
      const perPage = Math.min(Math.max(limit, 1), 100);
      const commits: FileCommit[] = [
        {
          sha: "fixture0000000000000000000000000000000001",
          message: `Fixture history for ${rel} (not Unreal Engine source)`,
          author: "ue-tools-fixture",
          date: "2026-01-01T00:00:00Z",
          htmlUrl: `https://github.com/${FIXTURE_REPO}/commit/fixture0000000000000000000000000000000001`,
        },
        {
          sha: "fixture0000000000000000000000000000000000",
          message: `Add fixture stub ${rel}`,
          author: "ue-tools-fixture",
          date: "2026-01-01T00:00:00Z",
        },
      ].slice(0, perPage);
      void ref;
      return commits;
    },
  };
}

export function matchesFilters(file: string, filters: SearchFilters): boolean {
  if (filters.path) {
    const prefix = normalizeRepoPath(filters.path);
    if (prefix && file !== prefix && !file.startsWith(`${prefix}/`)) return false;
  }
  if (filters.extension) {
    const ext = filters.extension.replace(/^\./, "").toLowerCase();
    if (!file.toLowerCase().endsWith(`.${ext}`)) return false;
  }
  if (filters.language) {
    const lang = filters.language.toLowerCase();
    const ext = path.posix.extname(file).slice(1).toLowerCase();
    const allowed = LANGUAGE_EXTENSIONS[lang];
    if (allowed) {
      if (!allowed.includes(ext)) return false;
    } else if (ext !== lang && ext !== lang.replace(/^\./, "")) {
      return false;
    }
  }
  return true;
}

function walkFiles(absDir: string, rel: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(absDir)) {
    const abs = path.join(absDir, name);
    const childRel = rel ? `${rel}/${name}` : name;
    if (fs.statSync(abs).isDirectory()) out.push(...walkFiles(abs, childRel));
    else out.push(childRel);
  }
  return out;
}

function resolveInside(root: string, rel: string): string {
  const abs = path.resolve(root, rel);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (abs !== root && !abs.startsWith(prefix)) {
    throw new UeToolsError("invalid_path", `Path must stay inside the fixture tree: ${rel}`);
  }
  return abs;
}
