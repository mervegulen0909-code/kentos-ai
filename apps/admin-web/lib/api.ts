import type { IntakeClassification, IntakeMissingField } from '@kentos/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3100/api/v1';

type ApiOptions = RequestInit & { token?: string };

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, cache: 'no-store' });
  if (!response.ok) throw new ApiError(response.status, `KentOS API ${response.status}: ${await response.text()}`);
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
  automationRate: number;
};

export type WidgetSettings = {
  tenantSlug: string;
  widgetEnabled: boolean;
  widgetTitle: string;
  widgetWelcome: string;
  widgetAllowedOrigins: string[];
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
  messages: Array<{ id: string; body: string; visibility: string; senderType: string; createdAt: string }>;
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
export type MessageTemplate = { id: string; key: string; body: string; locale: string; isActive: boolean };
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

export const adminApi = {
  overview: (token: string) => apiFetch<AnalyticsOverview>('/analytics/overview', { token }),
  channelSummary: (token: string) => apiFetch<AnalyticsChannelSummary[]>('/analytics/channels', { token }),
  tickets: (token: string) => apiFetch<TicketListItem[]>('/tickets', { token }),
  ticket: (token: string, id: string) => apiFetch<TicketDetail>(`/tickets/${id}`, { token }),
  auditLog: (token: string, id: string) => apiFetch<AuditLogItem[]>(`/tickets/${id}/audit-log`, { token }),
  handoffs: (token: string) => apiFetch<HandoffSummary[]>('/tickets/handoffs', { token }),
  handoff: (token: string, id: string) => apiFetch<HandoffDetail>(`/tickets/handoffs/${id}`, { token }),
  createTicketFromHandoff: (token: string, id: string) => apiFetch<HandoffCreateTicketResult>(`/tickets/handoffs/${id}/create-ticket`, { method: 'POST', token }),
  departments: (token: string) => apiFetch<Department[]>('/departments', { token }),
  categories: (token: string) => apiFetch<Category[]>('/categories', { token }),
  slaPolicies: (token: string) => apiFetch<SlaPolicy[]>('/sla-policies', { token }),
  messageTemplates: (token: string) => apiFetch<MessageTemplate[]>('/message-templates', { token }),
  widgetSettings: (token: string) => apiFetch<WidgetSettings>('/widget-settings', { token }),
  updateWidgetSettings: (token: string, input: Omit<WidgetSettings, 'tenantSlug'>) =>
    apiFetch<WidgetSettings>('/widget-settings', { method: 'PATCH', token, body: JSON.stringify(input) }),
};
