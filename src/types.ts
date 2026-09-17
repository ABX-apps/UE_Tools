export type SourceKind = "github" | "fixture";

export type StatusResult = {
  owner: string;
  repo: string;
  ref: string;
  source: SourceKind;
  tokenConfigured: boolean;
};

export type TextMatch = {
  fragment: string;
  property?: string;
};

export type SearchHit = {
  path: string;
  name: string;
  sha?: string;
  htmlUrl?: string;
  textMatches: TextMatch[];
};

export type SearchResult = {
  query: string;
  repo: string;
  total: number;
  incomplete: boolean;
  hits: SearchHit[];
};

export type FileResult = {
  path: string;
  ref: string;
  sha?: string;
  size: number;
  encoding: "utf-8";
  content: string;
};

export type TreeEntry = {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
};

export type TreeResult = {
  path: string;
  ref: string;
  entries: TreeEntry[];
};

export type ModuleLayer = "Runtime" | "Editor";

export type ModuleEntry = {
  name: string;
  layer: ModuleLayer;
  path: string;
};

export type ModulesResult = {
  ref: string;
  modules: ModuleEntry[];
};

export const RUNTIME_MODULES_PATH = "Engine/Source/Runtime";
export const EDITOR_MODULES_PATH = "Engine/Source/Editor";

export class UeToolsError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "UeToolsError";
    this.code = code;
    this.status = status;
  }
}
