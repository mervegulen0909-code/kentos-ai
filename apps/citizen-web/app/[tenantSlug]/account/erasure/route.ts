import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, citizenApi } from '../../../../lib/api';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  if (req.headers.get('x-requested-with') !== 'KentOS') {
    return NextResponse.json({ error: 'Gecersiz istek.' }, { status: 403 });
  }

  const { tenantSlug } = await params;
  const cookieStore = await cookies();
  const raw = cookieStore.get(`citizen_session_${tenantSlug}`)?.value;

  if (!raw) {
    return NextResponse.json({ error: 'Oturum bulunamadi.' }, { status: 401 });
  }

  let session: { sessionToken?: string } | null = null;
  try {
    session = JSON.parse(raw) as { sessionToken?: string };
  } catch {
    return NextResponse.json({ error: 'Oturum gecersiz.' }, { status: 401 });
  }

  if (!session.sessionToken) {
    return NextResponse.json({ error: 'Oturum gecersiz.' }, { status: 401 });
  }

  try {
    await citizenApi.requestErasure(tenantSlug, session.sessionToken);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return NextResponse.json({ error: 'Oturum gecersiz veya suresi dolmus.' }, { status: 401 });
    }
    if (error instanceof ApiError && error.status === 429) {
      return NextResponse.json({ error: 'Cok fazla istek gonderdiniz. Lutfen kisa bir sure sonra tekrar deneyin.' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Silme islemi basarisiz oldu.' }, { status: 500 });
  }

  // Path must match the path used when the cookie was set (/${tenantSlug})
  cookieStore.set(`citizen_session_${tenantSlug}`, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/${tenantSlug}`,
    maxAge: 0,
  });

  return NextResponse.json({ erased: true });
}
