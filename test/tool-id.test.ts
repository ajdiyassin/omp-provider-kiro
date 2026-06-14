import { describe, expect, it } from "vitest";
import { createKiroToolUseIdNormalizer, KIRO_TOOL_USE_ID_PATTERN } from "../src/tool-id.js";

describe("createKiroToolUseIdNormalizer", () => {
  it("Test 1: a valid Kiro ID remains unchanged", () => {
    const n = createKiroToolUseIdNormalizer();
    expect(n.normalize("toolu_01ABC_xyz")).toBe("toolu_01ABC_xyz");
  });

  it("Test 2: a foreign (Kimi) ID becomes valid and changes", () => {
    const n = createKiroToolUseIdNormalizer();
    const normalized = n.normalize("functions.find:4");
    expect(normalized).toMatch(KIRO_TOOL_USE_ID_PATTERN);
    expect(normalized).not.toBe("functions.find:4");
  });

  it("Test 3: mapping is stable for the same input", () => {
    const n = createKiroToolUseIdNormalizer();
    expect(n.normalize("functions.find:4")).toBe(n.normalize("functions.find:4"));
  });

  it("Test 4: invalid IDs that would naively collide do not collide", () => {
    const n = createKiroToolUseIdNormalizer();
    const first = n.normalize("tool:1");
    const second = n.normalize("tool.1");
    expect(first).not.toBe(second);
    expect(first).toMatch(KIRO_TOOL_USE_ID_PATTERN);
    expect(second).toMatch(KIRO_TOOL_USE_ID_PATTERN);
  });

  it("empty/whitespace IDs are mapped to a valid deterministic ID", () => {
    const n = createKiroToolUseIdNormalizer();
    const a = n.normalize("");
    expect(a).toMatch(KIRO_TOOL_USE_ID_PATTERN);
    // stable
    expect(createKiroToolUseIdNormalizer().normalize("")).toBe(a);
  });

  it("getMappings returns only the IDs that changed", () => {
    const n = createKiroToolUseIdNormalizer();
    n.normalize("toolu_keepme"); // valid, unchanged
    n.normalize("functions.search:6"); // changed
    const mappings = n.getMappings();
    expect(mappings).toHaveLength(1);
    expect(mappings[0].original).toBe("functions.search:6");
    expect(mappings[0].normalized).toMatch(KIRO_TOOL_USE_ID_PATTERN);
    expect(mappings.some((m) => m.original === "toolu_keepme")).toBe(false);
  });

  it("distinct foreign IDs map to distinct normalized IDs", () => {
    const n = createKiroToolUseIdNormalizer();
    const ids = ["functions.find:4", "functions.search:6", "functions.bash:3", "functions.eval:17"];
    const normalized = ids.map((id) => n.normalize(id));
    expect(new Set(normalized).size).toBe(ids.length);
    for (const v of normalized) expect(v).toMatch(KIRO_TOOL_USE_ID_PATTERN);
  });
});
