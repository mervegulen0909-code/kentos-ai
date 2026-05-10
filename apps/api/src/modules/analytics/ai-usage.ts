export type AiRunGroupRow = {
  provider: string;
  runs: number;
  successCount: number;
  tokensTotal: number;
  costMicros: number;
  totalLatencyMs: number;
};

export type AiUsageWindow = {
  runs: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  tokensTotal: number;
  costMicros: number;
  averageLatencyMs: number;
};

export type AiUsageProviderSummary = {
  provider: string;
  runs: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  tokensTotal: number;
  costMicros: number;
};

export type AiUsageReport = {
  generatedAt: string;
  windows: {
    last24h: AiUsageWindow;
    last7d: AiUsageWindow;
    last30d: AiUsageWindow;
  };
  byProvider: AiUsageProviderSummary[];
};

export function summarizeAiUsageWindow(rows: AiRunGroupRow[]): AiUsageWindow {
  const totals = rows.reduce(
    (acc, row) => {
      acc.runs += row.runs;
      acc.successCount += row.successCount;
      acc.tokensTotal += row.tokensTotal;
      acc.costMicros += row.costMicros;
      acc.totalLatencyMs += row.totalLatencyMs;
      return acc;
    },
    { runs: 0, successCount: 0, tokensTotal: 0, costMicros: 0, totalLatencyMs: 0 },
  );
  const failureCount = Math.max(0, totals.runs - totals.successCount);
  const successRate = totals.runs > 0 ? Number((totals.successCount / totals.runs).toFixed(3)) : 0;
  const averageLatencyMs = totals.runs > 0 ? Math.round(totals.totalLatencyMs / totals.runs) : 0;
  return {
    runs: totals.runs,
    successCount: totals.successCount,
    failureCount,
    successRate,
    tokensTotal: totals.tokensTotal,
    costMicros: totals.costMicros,
    averageLatencyMs,
  };
}

export function summarizeAiUsageByProvider(rows: AiRunGroupRow[]): AiUsageProviderSummary[] {
  const merged = new Map<string, AiRunGroupRow>();
  for (const row of rows) {
    const existing = merged.get(row.provider);
    if (!existing) {
      merged.set(row.provider, { ...row });
      continue;
    }
    existing.runs += row.runs;
    existing.successCount += row.successCount;
    existing.tokensTotal += row.tokensTotal;
    existing.costMicros += row.costMicros;
    existing.totalLatencyMs += row.totalLatencyMs;
  }
  return [...merged.values()]
    .map((row) => {
      const failureCount = Math.max(0, row.runs - row.successCount);
      const successRate = row.runs > 0 ? Number((row.successCount / row.runs).toFixed(3)) : 0;
      return {
        provider: row.provider,
        runs: row.runs,
        successCount: row.successCount,
        failureCount,
        successRate,
        tokensTotal: row.tokensTotal,
        costMicros: row.costMicros,
      };
    })
    .sort((a, b) => b.tokensTotal - a.tokensTotal || a.provider.localeCompare(b.provider));
}
