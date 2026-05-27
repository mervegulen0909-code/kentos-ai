const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3100/api/v1';

function safeErrorMessage(status: number) {
  if (status === 400) return 'Gonderdiginiz bilgiler dogrulanamadi.';
  if (status === 401 || status === 403) return 'Bu islem icin yetkiniz bulunmuyor.';
  if (status === 404) return 'Aradiginiz kayit bulunamadi.';
  if (status === 409) return 'Bu islem mevcut durumla cakisiyor.';
  if (status === 429) return 'Cok fazla istek gonderdiniz. Lutfen kisa bir sure sonra tekrar deneyin.';
  return 'Isleminiz su anda tamamlanamadi. Lutfen daha sonra tekrar deneyin.';
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

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, cache: 'no-store' });
  if (!response.ok) {
    const rawBody = await response.text();
    throw new ApiError(response.status, rawBody || `KentOS API ${response.status}`, safeErrorMessage(response.status));
  }
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
  attachments?: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string; scanStatus?: 'PENDING' | 'CLEAN' | 'INFECTED' | 'ERROR' | 'SKIPPED' | null }>;
  publicMessages: Array<{
    body: string;
    createdAt: string;
    author: 'municipality' | 'citizen';
    attachments?: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string; scanStatus?: 'PENDING' | 'CLEAN' | 'INFECTED' | 'ERROR' | 'SKIPPED' | null }>;
  }>;
};

export type CreatePublicTicketInput = {
  description: string;
  title?: string;
  displayName?: string;
  phone?: string;
  email?: string;
  addressText?: string;
  latitude?: number;
  longitude?: number;
  channel?: 'CITIZEN_WEB' | 'WEB_CHAT' | 'MOBILE_APP' | 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'SMS' | 'EMAIL';
  attachmentIds?: string[];
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
  channel: 'CITIZEN_WEB' | 'WEB_CHAT' | 'MOBILE_APP' | 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'SMS' | 'EMAIL';
  state: 'OPEN' | 'TICKET_CREATED';
  assistantMessage: string | null;
  missingFields: string[];
  followUpQuestion: string | null;
  trackingToken: string | null;
  handoffRequested: boolean;
};

export type StartPublicConversationInput = {
  channel?: 'CITIZEN_WEB' | 'WEB_CHAT' | 'MOBILE_APP' | 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'SMS' | 'EMAIL';
  displayName?: string;
  contact?: string;
  initialMessage?: string;
};

export type SendPublicConversationMessageInput = {
  text: string;
  displayName?: string;
  phone?: string;
  email?: string;
  attachmentIds?: string[];
};

export type CitizenAuthResult = {
  citizenId: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  sessionToken: string;
};

export const citizenApi = {
  firebaseLogin: (tenantSlug: string, idToken: string) =>
    apiFetch<CitizenAuthResult>(`/public/${tenantSlug}/auth/firebase`, {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }),
  createTicket: (tenantSlug: string, input: CreatePublicTicketInput) =>
    apiFetch<PublicTicket>(`/public/${tenantSlug}/tickets`, { method: 'POST', body: JSON.stringify(input) }),
  getTicket: (tenantSlug: string, ticketIdentifier: string) => apiFetch<PublicTicket>(`/public/${tenantSlug}/tickets/${ticketIdentifier}`),
  getWidgetSettings: (tenantSlug: string) => apiFetch<PublicWidgetSettings>(`/public/${tenantSlug}/widget-settings`),
  initiateAttachmentUpload: (tenantSlug: string, input: { fileName: string; mimeType: string; sizeBytes: number; trackingToken?: string; contact?: string }) =>
    apiFetch<{ attachmentId: string; uploadUrl: string; headers: Record<string, string>; expiresAt: string }>(`/public/${tenantSlug}/attachments/uploads`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  confirmAttachmentUpload: (tenantSlug: string, attachmentId: string, checksumSha256: string) =>
    apiFetch<{ attachmentId: string; checksumSha256: string }>(`/public/${tenantSlug}/attachments/${attachmentId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ checksumSha256 }),
    }),
  requestErasure: (tenantSlug: string, sessionToken: string) =>
    apiFetch<{ anonymized: boolean; citizenId: string }>(`/public/${tenantSlug}/citizen/erasure`, {
      method: 'POST',
      body: JSON.stringify({ sessionToken }),
    }),
  startConversation: (tenantSlug: string, input: StartPublicConversationInput) =>
    apiFetch<PublicConversation>(`/public/${tenantSlug}/conversations`, { method: 'POST', body: JSON.stringify(input) }),
  sendConversationMessage: (tenantSlug: string, conversationId: string, input: SendPublicConversationMessageInput) =>
    apiFetch<PublicConversation>(`/public/${tenantSlug}/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify(input) }),
};
