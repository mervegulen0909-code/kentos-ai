import { cookies } from 'next/headers';
import { ErasureClientButton } from './erasure-client-button';

type CitizenSession = {
  citizenId: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
} | null;

async function getCitizenSession(tenantSlug: string): Promise<CitizenSession> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(`citizen_session_${tenantSlug}`)?.value;
    if (!raw) return null;
    return JSON.parse(raw) as CitizenSession;
  } catch {
    return null;
  }
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const session = await getCitizenSession(tenantSlug);

  if (!session) {
    return (
      <main className="wrap">
        <section className="hero">
          <div className="card">
            <h1 className="display">Hesabım</h1>
            <div className="notice" role="note">
              Bu sayfayı görüntülemek için{' '}
              <a href={`/${tenantSlug}/login?redirect=/${tenantSlug}/account`}>giriş yapmanız</a> gerekiyor.
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="wrap">
      <section className="hero">
        <div className="card">
          <p className="eyebrow">{tenantSlug} · Hesabım</p>
          <h1 className="display">Kişisel Verilerim</h1>
          <div style={{ marginTop: '1.5rem', display: 'grid', gap: '0.75rem' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>Ad Soyad</p>
              <strong>{session.displayName ?? '—'}</strong>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>E-posta</p>
              <strong>{session.email ?? '—'}</strong>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>Telefon</p>
              <strong>{session.phone ?? '—'}</strong>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ marginTop: 0 }}>KVKK — Veri Silme Hakkı</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
            6698 sayılı KVKK kapsamında kişisel verilerinizin silinmesini talep edebilirsiniz.
            Bu işlem <strong>geri alınamaz</strong>: adınız, telefon ve e-posta bilgileriniz kalıcı olarak
            anonim hale getirilir. Belediyeye ilettiğiniz talepler teknik kayıt olarak korunmaya devam eder,
            ancak kişisel bilgilerinizle ilişkisi kesilir.
          </p>
          <ErasureClientButton tenantSlug={tenantSlug} />
        </div>
      </section>
    </main>
  );
}
