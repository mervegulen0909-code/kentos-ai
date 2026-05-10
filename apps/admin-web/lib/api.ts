import type { IntakeClassification, IntakeMissingField } from '@kentos/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3100/api/v1';

type ApiOptions = RequestInit & { token?: string };

function safeErrorMessage(status: number) {
  if (status === 400) return 'Gonderilen bilgiler dogrulanamadi.';
  if (status === 401) return 'Oturumunuz dogrulanamadi. Lutfen tekrar giris yapin.';
  if (status === 403) return 'Bu islem icin yetkiniz bulunmuyor.';
  if (status === 404) return 'Aradiginiz kayit bulunamadi.';
  if (status === 409) return 'Bu islem mevcut durumla cakisiyor.';
  if (status === 429) return 'Cok fazla istek gonderildi. Lutfen kisa bir sure sonra tekrar deneyin.';
  return 'Islem su anda tamamlanamadi. Lutfen daha sonra tekrar deneyin.';
}

export class ApiError extends Error {
  status: number;
  safeMessage: string;

  constructor(status: number, message: string, safeMessage = safeErrorMessage(status)) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.safeMessage = safeMessage;
  }
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, cache: 'no-store' });
  if (!response.ok) {
    const rawBody = await response.text();
    throw new ApiError(response.status, rawBody || `KentOS API ${response.status}`, safeErrorMessage(response.status));
  }
  return response.json() as Promise<T>;
}

export type AnalyticsOverview = {
  totalOpen: number;
  openedToday: number;
  resolvedToday: number;
  slaBreached: number;
  slaDueSoon: number;
  byStatus: Array<{ status: string; count: number }>;
};

export type AnalyticsChannelSummary = {
  channel: string;
  tickets: number;
  conversations: number;
  publicMessages: number;
  aiMessages: number;
  attachments: number;
  automationRate: number;
};

export type AnalyticsConversationSegments = {
  totalConversations: number;
  aiCompleted: number;
  operatorHandoff: number;
  awaitingInfo: number;
  automationRate: number;
};

export type AnalyticsAiUsageWindow = {
  runs: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  tokensTotal: number;
  costMicros: number;
  averageLatencyMs: number;
};

export type AnalyticsAiUsageProviderSummary = {
  provider: string;
  runs: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  tokensTotal: number;
  costMicros: number;
};

export type AnalyticsAiUsage = {
  generatedAt: string;
  windows: {
    last24h: AnalyticsAiUsageWindow;
    last7d: AnalyticsAiUsageWindow;
    last30d: AnalyticsAiUsageWindow;
  };
  byProvider: AnalyticsAiUsageProviderSummary[];
};

export type AnalyticsDepartmentSummary = {
  id: string;
  name: string;
  code: string;
  openTickets: number;
};

export type AnalyticsCategorySummary = {
  id: string;
  name: string;
  code: string;
  departmentName: string | null;
  tickets: number;
};

export type WidgetSettings = {
  tenantSlug: string;
  widgetEnabled: boolean;
  widgetTitle: string;
  widgetWelcome: string;
  widgetAllowedOrigins: string[];
};

export type RetentionScopeKey =
  | 'channel-events'
  | 'audit-logs'
  | 'outbound-deliveries'
  | 'conversations'
  | 'attachments';

export type RetentionSettings = {
  tenantSlug: string;
  defaults: Record<RetentionScopeKey, number>;
  overrides: Partial<Record<RetentionScopeKey, number>>;
};

export type UpdateRetentionInput = Partial<Record<RetentionScopeKey, number | null>>;

export type AiBudgetSettings = {
  tenantSlug: string;
  overrides: {
    dailyTokenBudget?: number;
    dailyCostBudgetMicros?: number;
    perRequestTokenLimit?: number;
  };
};

export type UpdateAiBudgetInput = {
  dailyTokenBudget?: number | null;
  dailyCostBudgetMicros?: number | null;
  perRequestTokenLimit?: number | null;
};

export type WidgetEmbedConfig = WidgetSettings & {
  scriptPath: string;
  previewPath: string;
  scriptSnippet: string;
};

export type TicketListItem = {
  id: string;
  ticketNo: string;
  title: string;
  status: string;
  priority: string;
  slaState?: 'OK' | 'DUE_SOON' | 'BREACHED' | 'UNKNOWN';
  department?: { name: string } | null;
  category?: { name: string } | null;
  assignedTo?: { id: string; fullName: string; email: string } | null;
};

export type AttachmentScanStatusKey = 'PENDING' | 'CLEAN' | 'INFECTED' | 'ERROR' | 'SKIPPED';

export type AttachmentSummary = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  scanStatus?: AttachmentScanStatusKey | null;
};

type TicketAiSummary = {
  confidence: number | null;
  classification: IntakeClassification | null;
  contactSignals: {
    hasPhone: boolean;
    hasEmail: boolean;
    displayName: string | null;
  } | null;
};

export type TicketDetail = TicketListItem & {
  description: string;
  addressText: string | null;
  aiSummary?: TicketAiSummary | null;
  attachments?: AttachmentSummary[];
  messages: Array<{
    id: string;
    body: string;
    visibility: string;
    senderType: string;
    createdAt: string;
    attachments?: AttachmentSummary[];
  }>;
  auditLogs?: Array<{ id: string; action: string; createdAt: string }>;
};

export function formatMissingFieldLabel(field: IntakeMissingField) {
  return {
    category: 'Kategori',
    contact: 'Iletisim',
    description: 'Aciklama',
    location: 'Konum',
    photo: 'Foto',
  }[field];
}

export type Department = { id: string; name: string; code: string; description?: string | null; isActive: boolean };
export type Category = { id: string; name: string; code: string; departmentId?: string | null; defaultPriority: string; isActive: boolean; department?: Department | null };
export type MessageTemplate = { id: string; key: string; body: string; locale: string; isActive: boolean; channel?: string | null };
export type SlaPolicy = { id: string; priority: string; responseMinutes: number; resolutionMinutes: number; isActive: boolean; department?: Department | null; category?: Category | null };
export type AuditLogItem = { id: string; action: string; createdAt: string; before?: unknown; after?: unknown };
export type HandoffSummary = {
  id: string;
  channel: string;
  state: string;
  handoffRequested: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  externalConversationId: string | null;
  citizen: {
    displayName: string | null;
    phone: string | null;
    email: string | null;
  };
  latestIntent: string | null;
  latestCitizenMessage: string | null;
  latestAssistantMessage: string | null;
  trackingToken: string | null;
  messageCount: number;
};
export type HandoffDetail = HandoffSummary & {
  followUpQuestion: string | null;
  classificationTitle: string | null;
  classificationDescription: string | null;
  missingFields: string[];
  messages: Array<{ role: 'citizen' | 'assistant'; text: string; at: string | null }>;
};

export type HandoffCreateTicketResult = {
  ticketId: string;
  ticketNo: string;
  trackingToken: string | null;
};

export type TicketListFilters = {
  status?: string;
  departmentId?: string;
  categoryId?: string;
  assignedToId?: string;
  q?: string;
};

function buildQuery(filters: TicketListFilters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const normalized = String(value ?? '').trim();
    if (normalized) params.set(key, normalized);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const adminApi = {
  overview: (token: string) => apiFetch<AnalyticsOverview>('/analytics/overview', { token }),
  departmentSummary: (token: string) => apiFetch<AnalyticsDepartmentSummary[]>('/analytics/departments', { token }),
  categorySummary: (token: string) => apiFetch<AnalyticsCategorySummary[]>('/analytics/categories', { token }),
  channelSummary: (token: string) => apiFetch<AnalyticsChannelSummary[]>('/analytics/channels', { token }),
  conversationSegments: (token: string) =>
    apiFetch<AnalyticsConversationSegments>('/analytics/conversation-segments', { token }),
  aiUsage: (token: string) => apiFetch<AnalyticsAiUsage>('/analytics/ai-usage', { token }),
  rescanAttachment: (token: string, attachmentId: string) =>
    apiFetch<{ attachmentId: string; scanStatus: 'PENDING' }>(`/attachments/${attachmentId}/rescan`, { method: 'POST', token }),
  quarantinedAttachments: (token: string) =>
    apiFetch<Array<{
      attachmentId: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      scanStatus: string;
      scanThreat: string | null;
      scannedAt: string | null;
      ticketId: string | null;
      ticketNo: string | null;
      ticketTitle: string | null;
    }>>('/attachments/quarantined', { token }),
  tickets: (token: string, filters?: TicketListFilters) => apiFetch<TicketListItem[]>(`/tickets${buildQuery(filters)}`, { token }),
  ticket: (token: string, id: string) => apiFetch<TicketDetail>(`/tickets/${id}`, { token }),
  auditLog: (token: string, id: string) => apiFetch<AuditLogItem[]>(`/tickets/${id}/audit-log`, { token }),
  handoffs: (token: string) => apiFetch<HandoffSummary[]>('/tickets/handoffs', { token }),
  handoff: (token: string, id: string) => apiFetch<HandoffDetail>(`/tickets/handoffs/${id}`, { token }),
  createTicketFromHandoff: (token: string, id: string) => apiFetch<HandoffCreateTicketResult>(`/tickets/handoffs/${id}/create-ticket`, { method: 'POST', token }),
  initiateAttachmentUpload: (token: string, input: { fileName: string; mimeType: string; sizeBytes: number; ticketId?: string }) =>
    apiFetch<{ attachmentId: string; uploadUrl: string; headers: Record<string, string>; expiresAt: string }>('/attachments/uploads', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),
  confirmAttachmentUpload: (token: string, attachmentId: string, checksumSha256: string) =>
    apiFetch<{ attachmentId: string; checksumSha256: string }>(`/attachments/${attachmentId}/confirm`, {
      method: 'POST',
      token,
      body: JSON.stringify({ checksumSha256 }),
    }),
  departments: (token: string) => apiFetch<Department[]>('/departments', { token }),
  categories: (token: string) => apiFetch<Category[]>('/categories', { token }),
  slaPolicies: (token: string) => apiFetch<SlaPolicy[]>('/sla-policies', { token }),
  messageTemplates: (token: string) => apiFetch<MessageTemplate[]>('/message-templates', { token }),
  widgetSettings: (token: string) => apiFetch<WidgetSettings>('/widget-settings', { token }),
  updateWidgetSettings: (token: string, input: Omit<WidgetSettings, 'tenantSlug'>) =>
    apiFetch<WidgetSettings>('/widget-settings', { method: 'PATCH', token, body: JSON.stringify(input) }),
  retentionSettings: (token: string) => apiFetch<RetentionSettings>('/retention-settings', { token }),
  updateRetentionSettings: (token: string, input: UpdateRetentionInput) =>
    apiFetch<RetentionSettings>('/retention-settings', { method: 'PATCH', token, body: JSON.stringify(input) }),
  aiBudgetSettings: (token: string) => apiFetch<AiBudgetSettings>('/ai-budget-settings', { token }),
  updateAiBudgetSettings: (token: string, input: UpdateAiBudgetInput) =>
    apiFetch<AiBudgetSettings>('/ai-budget-settings', { method: 'PATCH', token, body: JSON.stringify(input) }),
  runRetentionNow: (token: string) =>
    apiFetch<{ enqueued: boolean; tenantId: string }>('/retention-settings/run-now', { method: 'POST', token }),
};
