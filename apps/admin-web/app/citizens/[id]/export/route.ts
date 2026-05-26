import { NextResponse } from 'next/server';
import { adminApi } from '../../../../lib/api';
import { resolveAdminSession } from '../../../../lib/session';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveAdminSession();
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const data = await adminApi.exportCitizen(session.accessToken, id);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="vatandas-${id}.json"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Veri disari aktarilamadi.' }, { status: 502 });
  }
}
