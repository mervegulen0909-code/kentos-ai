'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '../../lib/api';
import { getSessionToken } from '../../lib/session';

async function requireToken() {
  const token = await getSessionToken();
  if (!token) throw new Error('Oturum bulunamadı.');
  return token;
}

export async function createDepartmentAction(formData: FormData) {
  const token = await requireToken();
  await apiFetch('/departments', {
    method: 'POST',
    token,
    body: JSON.stringify({
      code: String(formData.get('code') ?? '').trim(),
      name: String(formData.get('name') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim() || undefined,
    }),
  });
  revalidatePath('/settings');
}

export async function updateDepartmentAction(formData: FormData) {
  const token = await requireToken();
  const id = String(formData.get('id') ?? '');
  await apiFetch(`/departments/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      name: String(formData.get('name') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim() || undefined,
      isActive: formData.get('isActive') === 'true',
    }),
  });
  revalidatePath('/settings');
}

export async function createCategoryAction(formData: FormData) {
  const token = await requireToken();
  await apiFetch('/categories', {
    method: 'POST',
    token,
    body: JSON.stringify({
      code: String(formData.get('code') ?? '').trim(),
      name: String(formData.get('name') ?? '').trim(),
      departmentId: String(formData.get('departmentId') ?? '').trim() || undefined,
      defaultPriority: String(formData.get('defaultPriority') ?? 'NORMAL'),
    }),
  });
  revalidatePath('/settings');
}

export async function updateCategoryAction(formData: FormData) {
  const token = await requireToken();
  const id = String(formData.get('id') ?? '');
  await apiFetch(`/categories/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      name: String(formData.get('name') ?? '').trim(),
      departmentId: String(formData.get('departmentId') ?? '').trim() || undefined,
      defaultPriority: String(formData.get('defaultPriority') ?? 'NORMAL'),
      isActive: formData.get('isActive') === 'true',
    }),
  });
  revalidatePath('/settings');
}

export async function createSlaPolicyAction(formData: FormData) {
  const token = await requireToken();
  await apiFetch('/sla-policies', {
    method: 'POST',
    token,
    body: JSON.stringify({
      priority: String(formData.get('priority') ?? 'NORMAL'),
      responseMinutes: Number(formData.get('responseMinutes') ?? 240),
      resolutionMinutes: Number(formData.get('resolutionMinutes') ?? 4320),
      departmentId: String(formData.get('departmentId') ?? '').trim() || undefined,
      categoryId: String(formData.get('categoryId') ?? '').trim() || undefined,
    }),
  });
  revalidatePath('/settings');
}

export async function updateSlaPolicyAction(formData: FormData) {
  const token = await requireToken();
  const id = String(formData.get('id') ?? '');
  await apiFetch(`/sla-policies/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      responseMinutes: Number(formData.get('responseMinutes') ?? 240),
      resolutionMinutes: Number(formData.get('resolutionMinutes') ?? 4320),
      isActive: formData.get('isActive') === 'true',
    }),
  });
  revalidatePath('/settings');
}

export async function updateTemplateAction(formData: FormData) {
  const token = await requireToken();
  const id = String(formData.get('id') ?? '');
  await apiFetch(`/message-templates/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ body: String(formData.get('body') ?? '') }),
  });
  revalidatePath('/settings');
}
