import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { citizenApi } from '../../../../lib/api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await params;

  let idToken: string;
  try {
    const body = await request.json() as { idToken?: unknown };
    if (typeof body.idToken !== 'string' || !body.idToken) {
      return NextResponse.json({ error: 'idToken gerekli' }, { status: 400 });
    }
    idToken = body.idToken;
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof citizenApi.firebaseLogin>>;
  try {
    result = await citizenApi.firebaseLogin(tenantSlug, idToken);
  } catch {
    return NextResponse.json({ error: 'Firebase token doğrulanamadı' }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(`citizen_session_${tenantSlug}`, JSON.stringify(result), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 gün
    path: `/${tenantSlug}`,
  });

  return NextResponse.json({ ok: true, displayName: result.displayName });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await params;
  const cookieStore = await cookies();
  // Path must match the path used when the cookie was set (/${tenantSlug})
  cookieStore.set(`citizen_session_${tenantSlug}`, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/${tenantSlug}`,
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
