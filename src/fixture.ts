import fs from "node:fs";
import path from "node:path";
import { fixtureRoot } from "./config.js";
import { normalizeRepoPath } from "./paths.js";
import { UeToolsError, type SearchHit, type TreeEntry } from "./types.js";

export type FixtureClient = {
  searchCode(query: string): Promise<{ total: number; incomplete: boolean; hits: SearchHit[] }>;
  getFile(repoPath: string, ref: string): Promise<{ sha?: string; size: number; content: string }>;
  listTree(repoPath: string, ref: string): Promise<TreeEntry[]>;
};

export function createFixtureClient(): FixtureClient {
  const root = fixtureRoot();
  return {
    async searchCode(query: string) {
      const needle = query.replace(/\brepo:\S+/g, "").trim().toLowerCase();
      const files = walkFiles(root, "");
      const hits: SearchHit[] = [];
      for (const file of files) {
        const abs = path.join(root, file);
        const content = fs.readFileSync(abs, "utf8");
        const haystack = `${file}\n${content}`.toLowerCase();
        if (!needle || haystack.includes(needle)) {
          const line = content.split("\n").find((row) => row.toLowerCase().includes(needle));
          hits.push({
            path: file,
            name: path.posix.basename(file),
            textMatches: line ? [{ fragment: line.trim(), property: "content" }] : [],
          });
        }
      }
      return { total: hits.length, incomplete: false, hits };
    },

    async getFile(repoPath: string) {
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

    async listTree(repoPath: string) {
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
  };
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
