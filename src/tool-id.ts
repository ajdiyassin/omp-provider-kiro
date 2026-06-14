// ABOUTME: Normalizes tool-call IDs into Kiro-compatible IDs at serialization time only.
// ABOUTME: Foreign providers (e.g. Kimi's "functions.find:4") use characters Kiro rejects with
// ABOUTME: TOOL_SCHEMA_INVALID; this maps them deterministically while preserving call/result pairing.

import { createHash } from "node:crypto";

/** Kiro requires tool-use IDs to match this pattern. */
export const KIRO_TOOL_USE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export interface KiroToolUseIdMapping {
  original: string;
  normalized: string;
}

export interface KiroToolUseIdNormalizer {
  /** Map an original tool-use ID to a Kiro-safe ID. Stable for the same input within this normalizer. */
  normalize(original: string): string;
  /** All IDs that were actually changed (original !== normalized). */
  getMappings(): KiroToolUseIdMapping[];
}

/**
 * Create a per-request normalizer. Valid IDs pass through unchanged; invalid or empty IDs are
 * mapped to a deterministic `call_<sha256[:24]>` value. The same original always maps to the same
 * normalized value (so a tool call and its result stay paired), and two different originals never
 * collide onto the same normalized value (a numeric suffix is appended if needed).
 */
export function createKiroToolUseIdNormalizer(): KiroToolUseIdNormalizer {
  const normalizedByOriginal = new Map<string, string>();
  const ownerByNormalized = new Map<string, string>();

  function claim(original: string, preferred: string): string {
    let candidate = preferred;
    let suffix = 2;

    while (true) {
      const owner = ownerByNormalized.get(candidate);
      if (!owner || owner === original) {
        ownerByNormalized.set(candidate, original);
        normalizedByOriginal.set(original, candidate);
        return candidate;
      }
      candidate = `${preferred}_${suffix++}`;
    }
  }

  return {
    normalize(original: string): string {
      const existing = normalizedByOriginal.get(original);
      if (existing) return existing;

      if (original && KIRO_TOOL_USE_ID_PATTERN.test(original)) {
        return claim(original, original);
      }

      const digest = createHash("sha256")
        .update(original || "<empty-tool-use-id>")
        .digest("hex")
        .slice(0, 24);

      return claim(original, `call_${digest}`);
    },

    getMappings(): KiroToolUseIdMapping[] {
      return Array.from(normalizedByOriginal, ([original, normalized]) => ({ original, normalized })).filter(
        ({ original, normalized }) => original !== normalized,
      );
    },
  };
}
