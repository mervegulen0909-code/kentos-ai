'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { getSessionToken } from '../../lib/session';

async function requireToken() {
  const token = await getSessionToken();
  if (!token) redirect('/settings?error=session');
  return token;
}

async function runSettingsMutation(formData: FormData, success: string, mutation: (token: string) => Promise<void>) {
  const token = await requireToken();

  try {
    await mutation(token);
  } catch {
    redirect(`/settings?error=${encodeURIComponent(String(formData.get('intent') ?? 'general'))}`);
  }

  revalidatePath('/settings');
  redirect(`/settings?success=${success}`);
}

export async function createDepartmentAction(formData: FormData) {
  await runSettingsMutation(formData, 'department-created', (token) => apiFetch('/departments', {
    method: 'POST',
    token,
    body: JSON.stringify({
      code: String(formData.get('code') ?? '').trim(),
      name: String(formData.get('name') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim() || undefined,
    }),
  }));
}

export async function updateDepartmentAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  await runSettingsMutation(formData, 'department-updated', (token) => apiFetch(`/departments/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      name: String(formData.get('name') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim() || undefined,
      isActive: formData.get('isActive') === 'true',
    }),
  }));
}

export async function createCategoryAction(formData: FormData) {
  await runSettingsMutation(formData, 'category-created', (token) => apiFetch('/categories', {
    method: 'POST',
    token,
    body: JSON.stringify({
      code: String(formData.get('code') ?? '').trim(),
      name: String(formData.get('name') ?? '').trim(),
      departmentId: String(formData.get('departmentId') ?? '').trim() || undefined,
      defaultPriority: String(formData.get('defaultPriority') ?? 'NORMAL'),
    }),
  }));
}

export async function updateCategoryAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  await runSettingsMutation(formData, 'category-updated', (token) => apiFetch(`/categories/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      name: String(formData.get('name') ?? '').trim(),
      departmentId: String(formData.get('departmentId') ?? '').trim() || undefined,
      defaultPriority: String(formData.get('defaultPriority') ?? 'NORMAL'),
      isActive: formData.get('isActive') === 'true',
    }),
  }));
}

export async function createSlaPolicyAction(formData: FormData) {
  await runSettingsMutation(formData, 'sla-created', (token) => apiFetch('/sla-policies', {
    method: 'POST',
    token,
    body: JSON.stringify({
      priority: String(formData.get('priority') ?? 'NORMAL'),
      responseMinutes: Number(formData.get('responseMinutes') ?? 240),
      resolutionMinutes: Number(formData.get('resolutionMinutes') ?? 4320),
      departmentId: String(formData.get('departmentId') ?? '').trim() || undefined,
      categoryId: String(formData.get('categoryId') ?? '').trim() || undefined,
    }),
  }));
}

export async function updateSlaPolicyAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  await runSettingsMutation(formData, 'sla-updated', (token) => apiFetch(`/sla-policies/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      responseMinutes: Number(formData.get('responseMinutes') ?? 240),
      resolutionMinutes: Number(formData.get('resolutionMinutes') ?? 4320),
      isActive: formData.get('isActive') === 'true',
    }),
  }));
}

export async function updateTemplateAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  await runSettingsMutation(formData, 'template-updated', (token) => apiFetch(`/message-templates/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ body: String(formData.get('body') ?? '') }),
  }));
}
