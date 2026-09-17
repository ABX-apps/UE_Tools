import { UeToolsError } from "./types.js";

export function normalizeRepoPath(input: string | undefined | null): string {
  if (input == null) return "";
  let value = input.trim().replaceAll("\\", "/");
  if (value === "." || value === "/") return "";
  value = value.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!value) return "";
  const parts = value.split("/").filter((part) => part && part !== ".");
  if (parts.some((part) => part === "..")) {
    throw new UeToolsError("invalid_path", `Path must stay inside the repo: ${input}`);
  }
  return parts.join("/");
}

export function joinRepoPath(...parts: string[]): string {
  return parts
    .flatMap((part) => normalizeRepoPath(part).split("/"))
    .filter(Boolean)
    .join("/");
}
