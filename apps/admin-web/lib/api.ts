const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3100/api/v1';

type ApiOptions = RequestInit & { token?: string };

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, cache: 'no-store' });
  if (!response.ok) throw new Error(`KentOS API ${response.status}: ${await response.text()}`);
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

export type TicketListItem = {
  id: string;
  ticketNo: string;
  title: string;
  status: string;
  priority: string;
  slaState?: 'OK' | 'DUE_SOON' | 'BREACHED' | 'UNKNOWN';
  department?: { name: string } | null;
};

export type TicketDetail = TicketListItem & {
  description: string;
  addressText: string | null;
  messages: Array<{ id: string; body: string; visibility: string; senderType: string; createdAt: string }>;
  auditLogs?: Array<{ id: string; action: string; createdAt: string }>;
};

export type Department = { id: string; name: string; code: string; description?: string | null };
export type Category = { id: string; name: string; code: string; departmentId?: string | null; defaultPriority: string; department?: Department | null };
export type MessageTemplate = { id: string; key: string; body: string; locale: string };
export type SlaPolicy = { id: string; priority: string; responseMinutes: number; resolutionMinutes: number; department?: Department | null; category?: Category | null };
export type AuditLogItem = { id: string; action: string; createdAt: string; before?: unknown; after?: unknown };

export const adminApi = {
  overview: (token: string) => apiFetch<AnalyticsOverview>('/analytics/overview', { token }),
  tickets: (token: string) => apiFetch<TicketListItem[]>('/tickets', { token }),
  ticket: (token: string, id: string) => apiFetch<TicketDetail>(`/tickets/${id}`, { token }),
  auditLog: (token: string, id: string) => apiFetch<AuditLogItem[]>(`/tickets/${id}/audit-log`, { token }),
  departments: (token: string) => apiFetch<Department[]>('/departments', { token }),
  categories: (token: string) => apiFetch<Category[]>('/categories', { token }),
  slaPolicies: (token: string) => apiFetch<SlaPolicy[]>('/sla-policies', { token }),
  messageTemplates: (token: string) => apiFetch<MessageTemplate[]>('/message-templates', { token }),
};
