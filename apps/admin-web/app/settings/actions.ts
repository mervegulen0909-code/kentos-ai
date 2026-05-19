'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, apiFetch } from '../../lib/api';
import { resolveAdminAccessToken } from '../../lib/session';

function requireNonEmpty(value: FormDataEntryValue | null, fallback: string) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(fallback);
  return normalized;
}

function requirePositiveInteger(value: FormDataEntryValue | null, fallback: string) {
  const normalized = Number(value ?? 0);
  if (!Number.isInteger(normalized) || normalized < 1) throw new Error(fallback);
  return normalized;
}

async function requireToken() {
  const token = await resolveAdminAccessToken();
  if (!token) redirect('/settings?error=session');
  return token;
}

async function runSettingsMutation(formData: FormData, success: string, mutation: (token: string) => Promise<void>) {
  const token = await requireToken();

  try {
    await mutation(token);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect('/settings?error=forbidden');
    }

    const params = new URLSearchParams({
      error: String(formData.get('intent') ?? 'general'),
    });

    if (error instanceof ApiError && error.safeMessage) {
      params.set('errorMessage', error.safeMessage);
    }

    redirect(`/settings?${params.toString()}`);
  }

  revalidatePath('/settings');
  redirect(`/settings?success=${success}`);
}

export async function createDepartmentAction(formData: FormData) {
  const code = requireNonEmpty(formData.get('code'), 'create-department');
  const name = requireNonEmpty(formData.get('name'), 'create-department');

  await runSettingsMutation(formData, 'department-created', (token) => apiFetch('/departments', {
    method: 'POST',
    token,
    body: JSON.stringify({
      code,
      name,
      description: String(formData.get('description') ?? '').trim() || undefined,
    }),
  }));
}

export async function updateDepartmentAction(formData: FormData) {
  const id = requireNonEmpty(formData.get('id'), 'update-department');
  const name = requireNonEmpty(formData.get('name'), 'update-department');

  await runSettingsMutation(formData, 'department-updated', (token) => apiFetch(`/departments/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      name,
      description: String(formData.get('description') ?? '').trim() || undefined,
      isActive: formData.get('isActive') === 'true',
    }),
  }));
}

export async function createCategoryAction(formData: FormData) {
  const code = requireNonEmpty(formData.get('code'), 'create-category');
  const name = requireNonEmpty(formData.get('name'), 'create-category');

  await runSettingsMutation(formData, 'category-created', (token) => apiFetch('/categories', {
    method: 'POST',
    token,
    body: JSON.stringify({
      code,
      name,
      departmentId: String(formData.get('departmentId') ?? '').trim() || undefined,
      defaultPriority: String(formData.get('defaultPriority') ?? 'NORMAL'),
    }),
  }));
}

export async function updateCategoryAction(formData: FormData) {
  const id = requireNonEmpty(formData.get('id'), 'update-category');
  const name = requireNonEmpty(formData.get('name'), 'update-category');

  await runSettingsMutation(formData, 'category-updated', (token) => apiFetch(`/categories/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      name,
      departmentId: String(formData.get('departmentId') ?? '').trim() || undefined,
      defaultPriority: String(formData.get('defaultPriority') ?? 'NORMAL'),
      isActive: formData.get('isActive') === 'true',
    }),
  }));
}

export async function createSlaPolicyAction(formData: FormData) {
  const responseMinutes = requirePositiveInteger(formData.get('responseMinutes'), 'create-sla');
  const resolutionMinutes = requirePositiveInteger(formData.get('resolutionMinutes'), 'create-sla');

  await runSettingsMutation(formData, 'sla-created', (token) => apiFetch('/sla-policies', {
    method: 'POST',
    token,
    body: JSON.stringify({
      priority: String(formData.get('priority') ?? 'NORMAL'),
      responseMinutes,
      resolutionMinutes,
      departmentId: String(formData.get('departmentId') ?? '').trim() || undefined,
      categoryId: String(formData.get('categoryId') ?? '').trim() || undefined,
    }),
  }));
}

export async function updateSlaPolicyAction(formData: FormData) {
  const id = requireNonEmpty(formData.get('id'), 'update-sla');
  const responseMinutes = requirePositiveInteger(formData.get('responseMinutes'), 'update-sla');
  const resolutionMinutes = requirePositiveInteger(formData.get('resolutionMinutes'), 'update-sla');

  await runSettingsMutation(formData, 'sla-updated', (token) => apiFetch(`/sla-policies/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      responseMinutes,
      resolutionMinutes,
      isActive: formData.get('isActive') === 'true',
    }),
  }));
}

export async function updateTemplateAction(formData: FormData) {
  const id = requireNonEmpty(formData.get('id'), 'update-template');
  const body = requireNonEmpty(formData.get('body'), 'update-template');
  const channelRaw = String(formData.get('channel') ?? '').trim();
  const allowedChannels = new Set(['', 'WHATSAPP', 'WEB_CHAT', 'CITIZEN_WEB', 'MOBILE_APP', 'INSTAGRAM', 'FACEBOOK', 'SMS']);
  const channel = allowedChannels.has(channelRaw) ? channelRaw : '';

  await runSettingsMutation(formData, 'template-updated', (token) => apiFetch(`/message-templates/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      body,
      isActive: formData.get('isActive') === 'true',
      channel: channel || null,
    }),
  }));
}

export async function updateWidgetSettingsAction(formData: FormData) {
  const widgetTitle = requireNonEmpty(formData.get('widgetTitle'), 'update-widget');
  const widgetWelcome = requireNonEmpty(formData.get('widgetWelcome'), 'update-widget');
  const widgetAllowedOrigins = String(formData.get('widgetAllowedOrigins') ?? '')
    .split(/\r?\n/)
    .map((origin) => origin.trim())
    .filter(Boolean);

  await runSettingsMutation(formData, 'widget-updated', (token) => apiFetch('/widget-settings', {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      widgetEnabled: formData.get('widgetEnabled') === 'true',
      widgetTitle,
      widgetWelcome,
      widgetAllowedOrigins,
    }),
  }));
}

export async function runRetentionNowAction(formData: FormData) {
  await runSettingsMutation(formData, 'retention-run-triggered', (token) => apiFetch('/retention-settings/run-now', {
    method: 'POST',
    token,
  }));
}

export async function updateAiBudgetSettingsAction(formData: FormData) {
  const fields = ['dailyTokenBudget', 'dailyCostBudgetMicros', 'perRequestTokenLimit'] as const;
  const payload: Record<string, number | null> = {};
  for (const field of fields) {
    const raw = String(formData.get(field) ?? '').trim();
    if (raw === '') {
      payload[field] = null;
      continue;
    }
    const numeric = Number(raw);
    if (!Number.isInteger(numeric) || numeric < 1) {
      throw new Error('update-ai-budget');
    }
    payload[field] = numeric;
  }

  await runSettingsMutation(formData, 'ai-budget-updated', (token) => apiFetch('/ai-budget-settings', {
    method: 'PATCH',
    token,
    body: JSON.stringify(payload),
  }));
}

export async function updateUserAction(formData: FormData) {
  const id = requireNonEmpty(formData.get('id'), 'update-user');

  await runSettingsMutation(formData, 'user-updated', (token) => {
    const payload: Record<string, unknown> = {};
    const fullName = String(formData.get('fullName') ?? '').trim();
    const role = String(formData.get('role') ?? '').trim();
    const isActive = formData.get('isActive');
    if (fullName) payload.fullName = fullName;
    if (role) payload.role = role;
    if (isActive !== null) payload.isActive = isActive === 'true';
    return apiFetch(`/users/${id}`, { method: 'PATCH', token, body: JSON.stringify(payload) });
  });
}

export async function updateRetentionSettingsAction(formData: FormData) {
  const scopes = ['channel-events', 'audit-logs', 'outbound-deliveries', 'conversations', 'attachments'] as const;
  const payload: Record<string, number | null> = {};
  for (const scope of scopes) {
    const raw = String(formData.get(scope) ?? '').trim();
    if (raw === '') {
      payload[scope] = null;
      continue;
    }
    const numeric = Number(raw);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 3650) {
      throw new Error('update-retention');
    }
    payload[scope] = numeric;
  }

  await runSettingsMutation(formData, 'retention-updated', (token) => apiFetch('/retention-settings', {
    method: 'PATCH',
    token,
    body: JSON.stringify(payload),
  }));
}
