import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, platform: vi.fn(() => "win32"), homedir: vi.fn(() => "C:\\Users\\TestUser") };
});

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, existsSync: vi.fn(() => false) };
});

describe("getKiroCliDbPath — Windows path resolution", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.LOCALAPPDATA = "C:\\Users\\TestUser\\AppData\\Local";
    process.env.APPDATA = "C:\\Users\\TestUser\\AppData\\Roaming";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("prefers LOCALAPPDATA\\Kiro-Cli\\data.sqlite3 when it exists", async () => {
    const { existsSync } = await import("node:fs");
    const localPath = "C:\\Users\\TestUser\\AppData\\Local\\Kiro-Cli\\data.sqlite3";
    (existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => p === localPath);

    const { getKiroCliDbPath } = await import("../src/kiro-cli.js");
    expect(getKiroCliDbPath()).toBe(localPath);
  });

  it("falls back to APPDATA\\kiro-cli\\data.sqlite3 when LOCALAPPDATA path missing", async () => {
    const { existsSync } = await import("node:fs");
    const roamingPath = "C:\\Users\\TestUser\\AppData\\Roaming\\kiro-cli\\data.sqlite3";
    (existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => p === roamingPath);

    const { getKiroCliDbPath } = await import("../src/kiro-cli.js");
    expect(getKiroCliDbPath()).toBe(roamingPath);
  });

  it("returns undefined when neither path exists", async () => {
    const { existsSync } = await import("node:fs");
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { getKiroCliDbPath } = await import("../src/kiro-cli.js");
    expect(getKiroCliDbPath()).toBeUndefined();
  });
});
