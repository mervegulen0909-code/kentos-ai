import { createReportAction } from './actions';

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { tenantSlug } = await params;
  const { error } = await searchParams;
  const action = createReportAction.bind(null, tenantSlug);

  return (
    <main className="wrap">
      <p style={{ color: 'var(--muted)', fontWeight: 700 }}>{tenantSlug} · Yeni başvuru</p>
      <section className="hero">
        <div>
          <h1 className="display">Talebinizi belediyeye iletin.</h1>
          <p style={{ color: 'var(--muted)', fontSize: '1.2rem' }}>Konum, açıklama ve iletişim bilgisiyle başvurunuzu oluşturun.</p>
        </div>
        <form action={action} className="card">
          {error ? (
            <p role="alert" style={{ color: 'oklch(54% 0.2 28)' }}>
              {error === 'description' ? 'Açıklama en az 10 karakter olmalı.' : 'Başvuru oluşturulamadı. Lütfen tekrar deneyin.'}
            </p>
          ) : null}
          <div className="field">
            <label htmlFor="description">Açıklama</label>
            <textarea id="description" name="description" rows={6} placeholder="Sorunu kısa ve net anlatın." required minLength={10} />
          </div>
          <div className="field">
            <label htmlFor="addressText">Adres</label>
            <input id="addressText" name="addressText" placeholder="Mahalle, sokak, bina önü" />
          </div>
          <div className="field">
            <label htmlFor="displayName">Ad soyad</label>
            <input id="displayName" name="displayName" placeholder="İsteğe bağlı" autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="phone">Telefon</label>
            <input id="phone" name="phone" placeholder="+905551112233" autoComplete="tel" />
          </div>
          <div className="field">
            <label htmlFor="email">E-posta</label>
            <input id="email" name="email" type="email" placeholder="ornek@posta.com" autoComplete="email" />
          </div>
          <button className="cta" type="submit">Başvuruyu oluştur</button>
        </form>
      </section>
    </main>
  );
}
