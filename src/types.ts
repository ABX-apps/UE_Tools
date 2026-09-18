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
  repo: string;
  snippet?: string;
  sha?: string;
  htmlUrl?: string;
  textMatches: TextMatch[];
};

export type SearchFilters = {
  path?: string;
  language?: string;
  extension?: string;
};

export type SearchResult = {
  query: string;
  repo: string;
  total: number;
  incomplete: boolean;
  hits: SearchHit[];
};

export type SymbolHit = SearchHit & {
  kind: SymbolKind;
  score: number;
};

export type SymbolKind = "uclass" | "class" | "struct" | "header" | "other";

export type SymbolResult = {
  name: string;
  query: string;
  repo: string;
  hits: SymbolHit[];
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

export type FileCommit = {
  sha: string;
  message: string;
  author?: string;
  date?: string;
  htmlUrl?: string;
};

export type HistoryResult = {
  path: string;
  ref: string;
  repo: string;
  source: SourceKind;
  note: string;
  lineBlame: false;
  commits: FileCommit[];
};

export const RUNTIME_MODULES_PATH = "Engine/Source/Runtime";
export const EDITOR_MODULES_PATH = "Engine/Source/Editor";

export const ACTOR_LIST_CANDIDATES = [
  {
    objectPath: "/Script/UnrealEd.Default__EditorActorSubsystem",
    functionName: "GetAllLevelActors",
  },
  {
    objectPath: "/Script/EditorScriptingUtilities.Default__EditorLevelLibrary",
    functionName: "GetAllLevelActors",
  },
] as const;

export const ACTOR_SELECT_CANDIDATES = [
  {
    objectPath: "/Script/UnrealEd.Default__EditorActorSubsystem",
    functionName: "GetSelectedLevelActors",
  },
  {
    objectPath: "/Script/EditorScriptingUtilities.Default__EditorLevelLibrary",
    functionName: "GetSelectedLevelActors",
  },
] as const;

export const CONSOLE_CALL = {
  objectPath: "/Script/Engine.Default__KismetSystemLibrary",
  functionName: "ExecuteConsoleCommand",
} as const;

export type RcHttpRoute = {
  path: string;
  verb: string;
  description?: string;
};

export type EditorStatusResult = {
  reachable: boolean;
  url: string;
  source: "remote-control" | "fixture";
  routes: RcHttpRoute[];
};

export type EditorActor = {
  path: string;
  name: string;
  class?: string;
};

export type EditorActorsResult = {
  url: string;
  source: "remote-control" | "fixture";
  via: { objectPath: string; functionName: string };
  filter?: { name?: string; class?: string };
  limit?: number;
  truncated: boolean;
  actors: EditorActor[];
};

export type EditorConsoleResult = {
  url: string;
  source: "remote-control" | "fixture";
  command: string;
  via: { objectPath: string; functionName: string };
  result: unknown;
};

export type EditorScreenshotResult = {
  available: false;
  imageReturned: false;
  url: string;
  source: "remote-control" | "fixture";
  reason: string;
  thumbnailRoute: string;
  workaround: string;
};

export type EditorHighResShotResult = EditorConsoleResult & {
  imageReturned: false;
  note: string;
};

export type EditorObjectDescribeResult = {
  url: string;
  source: "remote-control" | "fixture";
  objectPath: string;
  via: { method: "PUT"; path: "/remote/object/describe" };
  describe: unknown;
};

export type EditorObjectGetResult = {
  url: string;
  source: "remote-control" | "fixture";
  objectPath: string;
  propertyName?: string;
  access: "READ_ACCESS";
  via: { method: "PUT"; path: "/remote/object/property" };
  properties: unknown;
};

export type EditorObjectSetResult = {
  url: string;
  source: "remote-control" | "fixture";
  objectPath: string;
  propertyName: string;
  access: "WRITE_TRANSACTION_ACCESS" | "WRITE_ACCESS";
  via: { method: "PUT"; path: "/remote/object/property" };
  result: unknown;
};

export type EditorSelectResult = {
  url: string;
  source: "remote-control" | "fixture";
  via: { objectPath: string; functionName: string };
  note: string;
  actors: EditorActor[];
};

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
