const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3100/api/v1';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, cache: 'no-store' });
  if (!response.ok) throw new ApiError(response.status, `KentOS API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export type PublicTicket = {
  trackingToken: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  addressText: string | null;
  departmentName: string | null;
  categoryName: string | null;
  resolutionDueAt: string | null;
  createdAt: string;
  publicMessages: Array<{ body: string; createdAt: string; author: 'municipality' | 'citizen' }>;
};

export type CreatePublicTicketInput = {
  description: string;
  title?: string;
  displayName?: string;
  phone?: string;
  email?: string;
  addressText?: string;
  channel?: 'CITIZEN_WEB' | 'WEB_CHAT' | 'MOBILE_APP';
};

export type PublicWidgetSettings = {
  tenantSlug: string;
  widgetEnabled: boolean;
  widgetTitle: string;
  widgetWelcome: string;
  widgetAllowedOrigins: string[];
};

export type PublicConversation = {
  conversationId: string;
  channel: 'CITIZEN_WEB' | 'WEB_CHAT' | 'MOBILE_APP';
  state: 'OPEN' | 'TICKET_CREATED';
  assistantMessage: string | null;
  missingFields: string[];
  followUpQuestion: string | null;
  trackingToken: string | null;
  handoffRequested: boolean;
};

export type StartPublicConversationInput = {
  channel?: 'CITIZEN_WEB' | 'WEB_CHAT' | 'MOBILE_APP';
  displayName?: string;
  contact?: string;
  initialMessage?: string;
};

export type SendPublicConversationMessageInput = {
  text: string;
  displayName?: string;
  phone?: string;
  email?: string;
};

export const citizenApi = {
  createTicket: (tenantSlug: string, input: CreatePublicTicketInput) =>
    apiFetch<PublicTicket>(`/public/${tenantSlug}/tickets`, { method: 'POST', body: JSON.stringify(input) }),
  getTicket: (tenantSlug: string, ticketIdentifier: string) => apiFetch<PublicTicket>(`/public/${tenantSlug}/tickets/${ticketIdentifier}`),
  getWidgetSettings: (tenantSlug: string) => apiFetch<PublicWidgetSettings>(`/public/${tenantSlug}/widget-settings`),
  startConversation: (tenantSlug: string, input: StartPublicConversationInput) =>
    apiFetch<PublicConversation>(`/public/${tenantSlug}/conversations`, { method: 'POST', body: JSON.stringify(input) }),
  sendConversationMessage: (tenantSlug: string, conversationId: string, input: SendPublicConversationMessageInput) =>
    apiFetch<PublicConversation>(`/public/${tenantSlug}/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify(input) }),
};
