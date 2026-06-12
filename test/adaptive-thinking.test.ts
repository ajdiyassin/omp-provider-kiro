import { describe, expect, it, afterEach } from "vitest";
import {
  buildKiroAdaptiveThinkingPayload,
  isAdaptiveThinkingSupported,
  mapOmpEffortToKiroEffort,
} from "../src/adaptive-thinking.js";

describe("adaptive-thinking", () => {
  afterEach(() => {
    delete process.env.KIRO_ADAPTIVE_THINKING;
  });

  describe("isAdaptiveThinkingSupported", () => {
    it("returns true for the 4 adaptive models", () => {
      expect(isAdaptiveThinkingSupported("claude-opus-4-8")).toBe(true);
      expect(isAdaptiveThinkingSupported("claude-opus-4-7")).toBe(true);
      expect(isAdaptiveThinkingSupported("claude-opus-4-6")).toBe(true);
      expect(isAdaptiveThinkingSupported("claude-sonnet-4-6")).toBe(true);
    });
    it("returns false for non-adaptive models", () => {
      expect(isAdaptiveThinkingSupported("claude-haiku-4-5")).toBe(false);
      expect(isAdaptiveThinkingSupported("auto")).toBe(false);
      expect(isAdaptiveThinkingSupported("claude-opus-4-5")).toBe(false);
      expect(isAdaptiveThinkingSupported("qwen3-coder-next")).toBe(false);
    });
  });

  describe("mapOmpEffortToKiroEffort — opus-4.8 (5-tier)", () => {
    it.each([
      ["minimal", "low"],
      ["low", "medium"],
      ["medium", "high"],
      ["high", "xhigh"],
      ["xhigh", "max"],
    ] as const)("OMP %s → Kiro %s", (omp, kiro) => {
      expect(mapOmpEffortToKiroEffort("claude-opus-4-8", omp)).toBe(kiro);
    });
  });

  describe("mapOmpEffortToKiroEffort — opus-4.7 (5-tier, same map)", () => {
    it.each([
      ["minimal", "low"],
      ["low", "medium"],
      ["medium", "high"],
      ["high", "xhigh"],
      ["xhigh", "max"],
    ] as const)("OMP %s → Kiro %s", (omp, kiro) => {
      expect(mapOmpEffortToKiroEffort("claude-opus-4-7", omp)).toBe(kiro);
    });
  });

  describe("mapOmpEffortToKiroEffort — opus-4.6 (4-tier)", () => {
    it.each([
      ["minimal", "low"],
      ["low", "low"],
      ["medium", "medium"],
      ["high", "high"],
      ["xhigh", "max"],
    ] as const)("OMP %s → Kiro %s", (omp, kiro) => {
      expect(mapOmpEffortToKiroEffort("claude-opus-4-6", omp)).toBe(kiro);
    });
  });

  describe("mapOmpEffortToKiroEffort — sonnet-4.6 (4-tier)", () => {
    it.each([
      ["minimal", "low"],
      ["low", "low"],
      ["medium", "medium"],
      ["high", "high"],
      ["xhigh", "max"],
    ] as const)("OMP %s → Kiro %s", (omp, kiro) => {
      expect(mapOmpEffortToKiroEffort("claude-sonnet-4-6", omp)).toBe(kiro);
    });
  });

  it("mapOmpEffortToKiroEffort returns undefined for non-adaptive model", () => {
    expect(mapOmpEffortToKiroEffort("claude-haiku-4-5", "high")).toBeUndefined();
    expect(mapOmpEffortToKiroEffort("auto", "xhigh")).toBeUndefined();
  });

  describe("buildKiroAdaptiveThinkingPayload", () => {
    it("opus-4.8 xhigh → max, 128000", () => {
      expect(buildKiroAdaptiveThinkingPayload("claude-opus-4-8", "xhigh")).toEqual({
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort: "max" },
        max_tokens: 128000,
      });
    });
    it("opus-4.7 xhigh → max, 128000", () => {
      expect(buildKiroAdaptiveThinkingPayload("claude-opus-4-7", "xhigh")).toEqual({
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort: "max" },
        max_tokens: 128000,
      });
    });
    it("opus-4.6 xhigh → max, 64000", () => {
      expect(buildKiroAdaptiveThinkingPayload("claude-opus-4-6", "xhigh")).toEqual({
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort: "max" },
        max_tokens: 64000,
      });
    });
    it("sonnet-4.6 high → high, 64000", () => {
      expect(buildKiroAdaptiveThinkingPayload("claude-sonnet-4-6", "high")).toEqual({
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort: "high" },
        max_tokens: 64000,
      });
    });
    it("sonnet-4.6 xhigh → max, 64000", () => {
      expect(buildKiroAdaptiveThinkingPayload("claude-sonnet-4-6", "xhigh")).toEqual({
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort: "max" },
        max_tokens: 64000,
      });
    });
    it("uses model default effort when reasoning is undefined", () => {
      // opus-4.8 default → medium OMP → high Kiro
      const p = buildKiroAdaptiveThinkingPayload("claude-opus-4-8", undefined);
      expect(p?.output_config.effort).toBe("high");
    });
    it("returns undefined for non-adaptive models", () => {
      expect(buildKiroAdaptiveThinkingPayload("claude-haiku-4-5", "high")).toBeUndefined();
      expect(buildKiroAdaptiveThinkingPayload("auto", "xhigh")).toBeUndefined();
      expect(buildKiroAdaptiveThinkingPayload("qwen3-coder-next", "high")).toBeUndefined();
    });
    it("KIRO_ADAPTIVE_THINKING=0 omits thinking and output_config", () => {
      process.env.KIRO_ADAPTIVE_THINKING = "0";
      const p = buildKiroAdaptiveThinkingPayload("claude-opus-4-8", "xhigh");
      expect(p).toBeUndefined();
    });
  });
});
