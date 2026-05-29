import assert from 'node:assert/strict';
import { summarizeAiUsageByProvider, summarizeAiUsageWindow, type AiRunGroupRow } from './ai-usage.js';

function run(name: string, fn: () => void) {
  fn();
  console.log(`ai-usage ${name} passed`);
}

const rows: AiRunGroupRow[] = [
  { provider: 'openai', runs: 10, successCount: 8, tokensTotal: 12_000, costMicros: 36_000, totalLatencyMs: 50_000 },
  { provider: 'openai', runs: 5, successCount: 5, tokensTotal: 4_000, costMicros: 12_000, totalLatencyMs: 8_000 },
  { provider: 'stub', runs: 3, successCount: 3, tokensTotal: 0, costMicros: 0, totalLatencyMs: 30 },
];

run('summarizeAiUsageWindow aggregates totals across providers', () => {
  const window = summarizeAiUsageWindow(rows);
  assert.equal(window.runs, 18);
  assert.equal(window.successCount, 16);
  assert.equal(window.failureCount, 2);
  assert.equal(window.successRate, 0.889);
  assert.equal(window.tokensTotal, 16_000);
  assert.equal(window.costMicros, 48_000);
  assert.equal(window.averageLatencyMs, Math.round((50_000 + 8_000 + 30) / 18));
});

run('summarizeAiUsageWindow handles empty input', () => {
  const window = summarizeAiUsageWindow([]);
  assert.equal(window.runs, 0);
  assert.equal(window.successRate, 0);
  assert.equal(window.averageLatencyMs, 0);
});

run('summarizeAiUsageByProvider merges same provider and sorts by tokensTotal desc', () => {
  const out = summarizeAiUsageByProvider(rows);
  // iki 'openai' satiri tek saglayiciya birlesir → openai + stub = 2 satir
  assert.equal(out.length, 2);
  assert.equal(out[0].provider, 'openai');
  assert.equal(out[1].provider, 'stub');
  assert.equal(out[0].runs, 15);
  assert.equal(out[0].successCount, 13);
  assert.equal(out[0].failureCount, 2);
  assert.equal(out[0].successRate, 0.867);
  assert.equal(out[0].tokensTotal, 16_000);
});

run('summarizeAiUsageByProvider merges duplicate provider rows', () => {
  const dup: AiRunGroupRow[] = [
    { provider: 'anthropic', runs: 2, successCount: 2, tokensTotal: 100, costMicros: 300, totalLatencyMs: 200 },
    { provider: 'anthropic', runs: 3, successCount: 1, tokensTotal: 200, costMicros: 600, totalLatencyMs: 300 },
  ];
  const out = summarizeAiUsageByProvider(dup);
  assert.equal(out.length, 1);
  assert.equal(out[0].runs, 5);
  assert.equal(out[0].successCount, 3);
  assert.equal(out[0].failureCount, 2);
  assert.equal(out[0].tokensTotal, 300);
});

console.log('all ai-usage tests passed');
