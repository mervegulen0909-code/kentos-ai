export type AiBudgetConfig = {
  dailyTokenBudget: number | null;
  dailyCostBudgetMicros: number | null;
  perRequestTokenLimit: number | null;
  inputMicrosPerToken: number;
  outputMicrosPerToken: number;
  cacheReadRateMultiplier: number;
  cacheWriteRateMultiplier: number;
  blockMode: 'fallback' | 'error';
};

export type TenantAiBudgetOverrides = {
  dailyTokenBudget?: number | null;
  dailyCostBudgetMicros?: number | null;
  perRequestTokenLimit?: number | null;
};

const TENANT_BUDGET_MIN = 1;
const TENANT_BUDGET_MAX_TOKENS = 1_000_000_000;
const TENANT_BUDGET_MAX_COST_MICROS = 10_000_000_000;

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
  cacheReadInputTokens?: number | null;
  cacheCreationInputTokens?: number | null;
};

export function readAiBudgetConfig(env: NodeJS.ProcessEnv = process.env): AiBudgetConfig {
  return {
    dailyTokenBudget: parseOptionalInt(env.AI_DAILY_TOKEN_BUDGET),
    dailyCostBudgetMicros: parseOptionalInt(env.AI_DAILY_COST_BUDGET_MICROS),
    perRequestTokenLimit: parseOptionalInt(env.AI_PER_REQUEST_TOKEN_LIMIT),
    inputMicrosPerToken: parseFloatWithDefault(env.AI_COST_INPUT_MICROS_PER_TOKEN, 3),
    outputMicrosPerToken: parseFloatWithDefault(env.AI_COST_OUTPUT_MICROS_PER_TOKEN, 15),
    cacheReadRateMultiplier: parseFloatWithDefault(env.AI_COST_CACHE_READ_RATE_MULTIPLIER, 0.1),
    cacheWriteRateMultiplier: parseFloatWithDefault(env.AI_COST_CACHE_WRITE_RATE_MULTIPLIER, 1.25),
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
  // Anthropic prompt-cache pricing: cache reads are 0.1x input rate, cache writes are 1.25x.
  // tokensInput from Anthropic excludes cache_read_input_tokens and cache_creation_input_tokens, so we add separately.
  const baseInput = Math.max(0, usage.tokensInput ?? 0);
  const cacheRead = Math.max(0, usage.cacheReadInputTokens ?? 0);
  const cacheWrite = Math.max(0, usage.cacheCreationInputTokens ?? 0);
  const output = Math.max(0, usage.tokensOutput ?? 0);
  const cost =
    baseInput * config.inputMicrosPerToken +
    cacheRead * config.inputMicrosPerToken * config.cacheReadRateMultiplier +
    cacheWrite * config.inputMicrosPerToken * config.cacheWriteRateMultiplier +
    output * config.outputMicrosPerToken;
  return Math.max(0, Math.round(cost));
}

export function extractAnthropicUsage(payload: unknown): AiUsageInput {
  if (!payload || typeof payload !== 'object') return {};
  const usage = (payload as { usage?: unknown }).usage;
  if (!usage || typeof usage !== 'object') return {};
  const usageRec = usage as Record<string, unknown>;
  const input = usageRec.input_tokens;
  const output = usageRec.output_tokens;
  const total = usageRec.total_tokens;
  const cacheRead = usageRec.cache_read_input_tokens;
  const cacheWrite = usageRec.cache_creation_input_tokens;
  return {
    tokensInput: typeof input === 'number' ? input : null,
    tokensOutput: typeof output === 'number' ? output : null,
    tokensTotal: typeof total === 'number' ? total : null,
    cacheReadInputTokens: typeof cacheRead === 'number' ? cacheRead : null,
    cacheCreationInputTokens: typeof cacheWrite === 'number' ? cacheWrite : null,
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
  return (
    (usage.tokensInput ?? 0) +
    (usage.tokensOutput ?? 0) +
    (usage.cacheReadInputTokens ?? 0) +
    (usage.cacheCreationInputTokens ?? 0)
  );
}

function parseOptionalInt(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

export function normalizeTenantAiBudgetOverrides(value: unknown): TenantAiBudgetOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: TenantAiBudgetOverrides = {};
  const rec = value as Record<string, unknown>;
  result.dailyTokenBudget = sanitizeBudgetField(rec.dailyTokenBudget, TENANT_BUDGET_MAX_TOKENS);
  result.dailyCostBudgetMicros = sanitizeBudgetField(rec.dailyCostBudgetMicros, TENANT_BUDGET_MAX_COST_MICROS);
  result.perRequestTokenLimit = sanitizeBudgetField(rec.perRequestTokenLimit, TENANT_BUDGET_MAX_TOKENS);
  return result;
}

function sanitizeBudgetField(raw: unknown, max: number): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const numeric = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(numeric)) return undefined;
  if (numeric < TENANT_BUDGET_MIN || numeric > max) return undefined;
  return numeric;
}

export function mergeTenantBudget(envConfig: AiBudgetConfig, tenantOverrides: TenantAiBudgetOverrides | null | undefined): AiBudgetConfig {
  if (!tenantOverrides) return envConfig;
  return {
    ...envConfig,
    dailyTokenBudget: typeof tenantOverrides.dailyTokenBudget === 'number'
      ? tenantOverrides.dailyTokenBudget
      : envConfig.dailyTokenBudget,
    dailyCostBudgetMicros: typeof tenantOverrides.dailyCostBudgetMicros === 'number'
      ? tenantOverrides.dailyCostBudgetMicros
      : envConfig.dailyCostBudgetMicros,
    perRequestTokenLimit: typeof tenantOverrides.perRequestTokenLimit === 'number'
      ? tenantOverrides.perRequestTokenLimit
      : envConfig.perRequestTokenLimit,
  };
}

function parseFloatWithDefault(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const numeric = Number.parseFloat(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric;
}
