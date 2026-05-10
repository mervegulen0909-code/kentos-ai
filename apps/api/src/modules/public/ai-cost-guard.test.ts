import assert from 'node:assert/strict';
import {
  decideAiBudget,
  estimateCostMicros,
  extractAnthropicUsage,
  extractOpenAiUsage,
  readAiBudgetConfig,
  totalTokens,
} from './ai-cost-guard.js';

function run(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(() => console.log(`ai-cost-guard ${name} passed`));
}

await run('readAiBudgetConfig defaults to fallback block mode and zero limits', () => {
  const cfg = readAiBudgetConfig({});
  assert.equal(cfg.dailyTokenBudget, null);
  assert.equal(cfg.dailyCostBudgetMicros, null);
  assert.equal(cfg.perRequestTokenLimit, null);
  assert.equal(cfg.blockMode, 'fallback');
  assert.equal(cfg.inputMicrosPerToken, 3);
  assert.equal(cfg.outputMicrosPerToken, 15);
});

await run('readAiBudgetConfig parses positive integers and rejects junk', () => {
  const cfg = readAiBudgetConfig({
    AI_DAILY_TOKEN_BUDGET: '100000',
    AI_DAILY_COST_BUDGET_MICROS: '50000000',
    AI_PER_REQUEST_TOKEN_LIMIT: 'abc',
    AI_COST_INPUT_MICROS_PER_TOKEN: '4.5',
    AI_COST_OUTPUT_MICROS_PER_TOKEN: 'NaN',
    AI_DAILY_BUDGET_BLOCK_MODE: 'error',
  } as NodeJS.ProcessEnv);
  assert.equal(cfg.dailyTokenBudget, 100000);
  assert.equal(cfg.dailyCostBudgetMicros, 50000000);
  assert.equal(cfg.perRequestTokenLimit, null);
  assert.equal(cfg.inputMicrosPerToken, 4.5);
  assert.equal(cfg.outputMicrosPerToken, 15);
  assert.equal(cfg.blockMode, 'error');
});

await run('decideAiBudget allows when no limits set', () => {
  const decision = decideAiBudget({ tokensTotal: 10_000_000, costMicros: 0 }, readAiBudgetConfig({}));
  assert.equal(decision.allowed, true);
});

await run('decideAiBudget blocks on token budget exceeded', () => {
  const cfg = readAiBudgetConfig({ AI_DAILY_TOKEN_BUDGET: '100' } as NodeJS.ProcessEnv);
  const decision = decideAiBudget({ tokensTotal: 100, costMicros: 0 }, cfg);
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reason, 'token-budget-exceeded');
});

await run('decideAiBudget blocks on cost budget exceeded before token budget', () => {
  const cfg = readAiBudgetConfig({ AI_DAILY_COST_BUDGET_MICROS: '500' } as NodeJS.ProcessEnv);
  const decision = decideAiBudget({ tokensTotal: 0, costMicros: 1000 }, cfg);
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reason, 'cost-budget-exceeded');
});

await run('estimateCostMicros applies per-token rates', () => {
  const cfg = readAiBudgetConfig({
    AI_COST_INPUT_MICROS_PER_TOKEN: '3',
    AI_COST_OUTPUT_MICROS_PER_TOKEN: '15',
  } as NodeJS.ProcessEnv);
  assert.equal(estimateCostMicros({ tokensInput: 1000, tokensOutput: 500 }, cfg), 1000 * 3 + 500 * 15);
});

await run('estimateCostMicros treats missing token counts as zero', () => {
  const cfg = readAiBudgetConfig({} as NodeJS.ProcessEnv);
  assert.equal(estimateCostMicros({}, cfg), 0);
});

await run('extractAnthropicUsage reads input/output token counts', () => {
  const usage = extractAnthropicUsage({ usage: { input_tokens: 120, output_tokens: 240 } });
  assert.equal(usage.tokensInput, 120);
  assert.equal(usage.tokensOutput, 240);
  assert.equal(totalTokens(usage), 360);
});

await run('extractOpenAiUsage handles prompt/completion variant', () => {
  const usage = extractOpenAiUsage({ usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } });
  assert.equal(usage.tokensInput, 100);
  assert.equal(usage.tokensOutput, 50);
  assert.equal(usage.tokensTotal, 150);
});

await run('extractOpenAiUsage returns empty object for missing usage', () => {
  assert.deepEqual(extractOpenAiUsage(undefined), {});
  assert.deepEqual(extractOpenAiUsage(null), {});
  assert.deepEqual(extractOpenAiUsage({ choices: [] }), {});
});

console.log('all ai-cost-guard tests passed');
