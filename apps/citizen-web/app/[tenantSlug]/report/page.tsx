import { createReportAction } from './actions';

const errorCopy: Record<string, { title: string; detail: string }> = {
  description: {
    title: 'Açıklama biraz kısa kaldı.',
    detail: 'Belediye ekibinin doğru birime yönlendirebilmesi için sorunu en az 10 karakterle, mümkünse konum veya belirtiyle anlatın.',
  },
  api: {
    title: 'Başvuruyu şu an alamadık.',
    detail: 'Bilgileriniz ekranda güvende. Bağlantınızı kontrol edip birkaç dakika sonra yeniden deneyin.',
  },
};

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ error?: string; field?: string }>;
}) {
  const { tenantSlug } = await params;
  const { error, field } = await searchParams;
  const errorMessage = error ? (errorCopy[error] ?? errorCopy.api) : null;
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
          {errorMessage ? (
            <div className="notice error" role="alert">
              <strong>{errorMessage.title}</strong>
              <p>{errorMessage.detail}</p>
            </div>
          ) : null}
          <div className={`field ${field === 'description' ? 'field-error' : ''}`}>
            <label htmlFor="description">Açıklama</label>
            <textarea id="description" name="description" rows={6} placeholder="Örn. Kaldırım taşları yerinden çıkmış, bebek arabası geçemiyor." required minLength={10} aria-describedby="description-help" aria-invalid={field === 'description'} />
            <small id="description-help">En az 10 karakter yazın; mahalle, sokak veya ayırt edici bir nokta eklerseniz ekip daha hızlı yönlenir.</small>
          </div>
          <div className="field">
            <label htmlFor="addressText">Adres veya konum tarifi</label>
            <input id="addressText" name="addressText" placeholder="Mahalle, sokak, bina önü veya yakınındaki bilinen nokta" autoComplete="street-address" />
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
