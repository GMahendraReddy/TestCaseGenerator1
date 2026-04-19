import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

/**
 * Load `.env` / `.env.local` from every likely location (npm workspaces, `cd backend`, etc.).
 * Later files override earlier ones so a non-empty key in any file wins.
 */
export function loadEnv(): void {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(__dirname, "../..");
  const backendRoot = path.resolve(__dirname, "..");
  const cwd = process.cwd();

  const files: string[] = [
    path.join(repoRoot, ".env"),
    path.join(repoRoot, ".env.local"),
    path.join(backendRoot, ".env"),
    path.join(backendRoot, ".env.local"),
    path.join(cwd, ".env"),
    path.join(cwd, ".env.local"),
  ];

  // When the API runs with cwd `.../backend`, still pick up the monorepo root `.env`.
  if (path.basename(cwd) === "backend") {
    files.push(path.join(cwd, "..", ".env"));
    files.push(path.join(cwd, "..", ".env.local"));
  }

  const seen = new Set<string>();
  const loaded: string[] = [];
  for (const file of files) {
    const normalized = path.normalize(file);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    if (!fs.existsSync(file)) continue;
    dotenv.config({ path: file, override: true });
    loaded.push(normalized);
  }

  if (process.env.DEBUG_ENV === "1") {
    console.log("[loadEnv] loaded files:", loaded.length ? loaded : "(none)");
  }
}

const OPENROUTER_PLACEHOLDERS = new Set([
  "your-api-key-here",
  "sk-your-key-here",
  "sk-or-v1-your-key-here",
]);

function normalizeSecretValue(raw: string): string {
  let s = raw.replace(/^\uFEFF/, "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** Returns trimmed OpenRouter key, or undefined if missing / placeholder. */
export function getOpenRouterApiKey(): string | undefined {
  const raw =
    process.env.OPENROUTER_API_KEY ?? process.env.OPENROUTER_KEY;
  if (raw === undefined || raw === null) return undefined;
  const trimmed = normalizeSecretValue(raw);
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (OPENROUTER_PLACEHOLDERS.has(lower) || lower.startsWith("sk-your-key")) {
    return undefined;
  }
  return trimmed;
}
