export type AiBudgetConfig = {
  dailyTokenBudget: number | null;
  dailyCostBudgetMicros: number | null;
  perRequestTokenLimit: number | null;
  inputMicrosPerToken: number;
  outputMicrosPerToken: number;
  blockMode: 'fallback' | 'error';
};

export type AiBudgetUsage = {
  tokensTotal: number;
  costMicros: number;
};

export type AiBudgetDecision =
  | { allowed: true; usage: AiBudgetUsage }
  | { allowed: false; reason: 'token-budget-exceeded' | 'cost-budget-exceeded'; usage: AiBudgetUsage };

export type AiUsageInput = {
  tokensInput?: number | null;
  tokensOutput?: number | null;
  tokensTotal?: number | null;
};

export function readAiBudgetConfig(env: NodeJS.ProcessEnv = process.env): AiBudgetConfig {
  return {
    dailyTokenBudget: parseOptionalInt(env.AI_DAILY_TOKEN_BUDGET),
    dailyCostBudgetMicros: parseOptionalInt(env.AI_DAILY_COST_BUDGET_MICROS),
    perRequestTokenLimit: parseOptionalInt(env.AI_PER_REQUEST_TOKEN_LIMIT),
    inputMicrosPerToken: parseFloatWithDefault(env.AI_COST_INPUT_MICROS_PER_TOKEN, 3),
    outputMicrosPerToken: parseFloatWithDefault(env.AI_COST_OUTPUT_MICROS_PER_TOKEN, 15),
    blockMode: env.AI_DAILY_BUDGET_BLOCK_MODE === 'error' ? 'error' : 'fallback',
  };
}

export function decideAiBudget(usage: AiBudgetUsage, config: AiBudgetConfig): AiBudgetDecision {
  if (config.dailyTokenBudget != null && usage.tokensTotal >= config.dailyTokenBudget) {
    return { allowed: false, reason: 'token-budget-exceeded', usage };
  }
  if (config.dailyCostBudgetMicros != null && usage.costMicros >= config.dailyCostBudgetMicros) {
    return { allowed: false, reason: 'cost-budget-exceeded', usage };
  }
  return { allowed: true, usage };
}

export function estimateCostMicros(usage: AiUsageInput, config: AiBudgetConfig): number {
  const input = Math.max(0, usage.tokensInput ?? 0);
  const output = Math.max(0, usage.tokensOutput ?? 0);
  const cost = input * config.inputMicrosPerToken + output * config.outputMicrosPerToken;
  return Math.max(0, Math.round(cost));
}

export function extractAnthropicUsage(payload: unknown): AiUsageInput {
  if (!payload || typeof payload !== 'object') return {};
  const usage = (payload as { usage?: unknown }).usage;
  if (!usage || typeof usage !== 'object') return {};
  const input = (usage as { input_tokens?: unknown }).input_tokens;
  const output = (usage as { output_tokens?: unknown }).output_tokens;
  const total = (usage as { total_tokens?: unknown }).total_tokens;
  return {
    tokensInput: typeof input === 'number' ? input : null,
    tokensOutput: typeof output === 'number' ? output : null,
    tokensTotal: typeof total === 'number' ? total : null,
  };
}

export function extractOpenAiUsage(payload: unknown): AiUsageInput {
  if (!payload || typeof payload !== 'object') return {};
  const usage = (payload as { usage?: unknown }).usage;
  if (!usage || typeof usage !== 'object') return {};
  const input = (usage as { prompt_tokens?: unknown; input_tokens?: unknown }).prompt_tokens
    ?? (usage as { input_tokens?: unknown }).input_tokens;
  const output = (usage as { completion_tokens?: unknown; output_tokens?: unknown }).completion_tokens
    ?? (usage as { output_tokens?: unknown }).output_tokens;
  const total = (usage as { total_tokens?: unknown }).total_tokens;
  return {
    tokensInput: typeof input === 'number' ? input : null,
    tokensOutput: typeof output === 'number' ? output : null,
    tokensTotal: typeof total === 'number' ? total : null,
  };
}

export function totalTokens(usage: AiUsageInput): number {
  if (typeof usage.tokensTotal === 'number') return usage.tokensTotal;
  return (usage.tokensInput ?? 0) + (usage.tokensOutput ?? 0);
}

function parseOptionalInt(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

function parseFloatWithDefault(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const numeric = Number.parseFloat(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric;
}
