// ABOUTME: Adaptive-thinking mapper for Kiro API.
// ABOUTME: Builds the additionalModelRequestFields payload per model + OMP effort level.

export type OmpEffort = "minimal" | "low" | "medium" | "high" | "xhigh";
export type KiroEffort = "low" | "medium" | "high" | "xhigh" | "max";

export type KiroAdaptivePayload = {
  thinking: { type: "adaptive"; display: "summarized" };
  output_config: { effort: KiroEffort };
  max_tokens: number;
};

type ModelConfig = {
  kiroModelId: string;
  maxTokens: number;
  defaultOmpEffort: OmpEffort;
  effortMap: Record<OmpEffort, KiroEffort>;
};

const FIVE_TIER: Record<OmpEffort, KiroEffort> = {
  minimal: "low",
  low: "medium",
  medium: "high",
  high: "xhigh",
  xhigh: "max",
};

const FOUR_TIER: Record<OmpEffort, KiroEffort> = {
  minimal: "low",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "max",
};

const KIRO_ADAPTIVE_MODELS: Record<string, ModelConfig> = {
  "claude-opus-4-8": { kiroModelId: "claude-opus-4.8", maxTokens: 128000, defaultOmpEffort: "medium", effortMap: FIVE_TIER },
  "claude-opus-4-7": { kiroModelId: "claude-opus-4.7", maxTokens: 128000, defaultOmpEffort: "high",   effortMap: FIVE_TIER },
  "claude-opus-4-6": { kiroModelId: "claude-opus-4.6", maxTokens: 64000,  defaultOmpEffort: "high",   effortMap: FOUR_TIER },
  "claude-sonnet-4-6": { kiroModelId: "claude-sonnet-4.6", maxTokens: 64000, defaultOmpEffort: "high", effortMap: FOUR_TIER },
};

export function isAdaptiveThinkingSupported(modelId: string): boolean {
  return Object.hasOwn(KIRO_ADAPTIVE_MODELS, modelId);
}

export function mapOmpEffortToKiroEffort(modelId: string, effort: OmpEffort | undefined): KiroEffort | undefined {
  const cfg = KIRO_ADAPTIVE_MODELS[modelId];
  if (!cfg) return undefined;
  return cfg.effortMap[effort ?? cfg.defaultOmpEffort];
}

export function buildKiroAdaptiveThinkingPayload(
  modelId: string,
  ompEffort: OmpEffort | undefined,
): KiroAdaptivePayload | undefined {
  if (process.env.KIRO_ADAPTIVE_THINKING === "0") return undefined;
  const cfg = KIRO_ADAPTIVE_MODELS[modelId];
  if (!cfg) return undefined;
  const effort = cfg.effortMap[ompEffort ?? cfg.defaultOmpEffort];
  return {
    thinking: { type: "adaptive", display: "summarized" },
    output_config: { effort },
    max_tokens: cfg.maxTokens,
  };
}
