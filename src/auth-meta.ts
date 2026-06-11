import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const META_PATH = join(homedir(), ".omp-provider-kiro", "auth-meta.json");

export interface KiroAuthMeta {
  apiRegion?: string;
  profileArn?: string;
  updatedAt: number;
}

function tokenKey(accessToken: string): string {
  return createHash("sha256").update(accessToken).digest("hex").slice(0, 16);
}

function readAll(): Record<string, KiroAuthMeta> {
  try {
    if (!existsSync(META_PATH)) return {};
    return JSON.parse(readFileSync(META_PATH, "utf-8"));
  } catch {
    return {};
  }
}

export function readAuthMeta(accessToken: string): KiroAuthMeta | undefined {
  const data = readAll();
  return data[tokenKey(accessToken)];
}

export function writeAuthMeta(accessToken: string, meta: KiroAuthMeta): void {
  try {
    const dir = dirname(META_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const data = readAll();
    data[tokenKey(accessToken)] = meta;
    writeFileSync(META_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Best effort
  }
}

export function clearAuthMeta(accessToken: string): void {
  try {
    const data = readAll();
    delete data[tokenKey(accessToken)];
    writeFileSync(META_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Best effort
  }
}
