'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminApi } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';

export async function createFaqAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  await adminApi.createFaqArticle(session.accessToken, {
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? ''),
    slug: String(formData.get('slug') ?? '').replace(/\s+/g, '-').toLowerCase(),
    lang: String(formData.get('lang') ?? 'tr'),
    isPublished: formData.get('isPublished') === 'on',
  });
  revalidatePath('/faq');
}

export async function toggleFaqPublishAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  const id = String(formData.get('id') ?? '');
  const isPublished = formData.get('isPublished') === 'true';
  await adminApi.updateFaqArticle(session.accessToken, id, { isPublished: !isPublished });
  revalidatePath('/faq');
}

export async function deleteFaqAction(formData: FormData) {
  const session = await resolveAdminSession();
  if (!session) redirect('/login');
  await adminApi.deleteFaqArticle(session.accessToken, String(formData.get('id') ?? ''));
  revalidatePath('/faq');
}
