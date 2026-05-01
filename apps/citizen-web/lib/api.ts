const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3100/api/v1';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, cache: 'no-store' });
  if (!response.ok) throw new Error(`KentOS API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export type PublicTicket = {
  ticketNo: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  addressText: string | null;
  departmentName: string | null;
  categoryName: string | null;
  resolutionDueAt: string | null;
  createdAt: string;
  publicMessages: Array<{ body: string; createdAt: string; senderType: string }>;
};

export type CreatePublicTicketInput = {
  description: string;
  title?: string;
  displayName?: string;
  phone?: string;
  email?: string;
  addressText?: string;
};

export const citizenApi = {
  createTicket: (tenantSlug: string, input: CreatePublicTicketInput) =>
    apiFetch<PublicTicket>(`/public/${tenantSlug}/tickets`, { method: 'POST', body: JSON.stringify(input) }),
  getTicket: (tenantSlug: string, ticketNo: string) => apiFetch<PublicTicket>(`/public/${tenantSlug}/tickets/${ticketNo}`),
};
