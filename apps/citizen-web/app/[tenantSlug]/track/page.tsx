import { trackTicketAction } from './actions';

const errorCopy: Record<string, { title: string; detail: string }> = {
  missing: {
    title: 'Takip kodu eksik.',
    detail: 'Takip için başvuru sonrası verilen kod gerekir. T.C. kimlik, telefon veya ad-soyad ile sorgulama yapılmaz.',
  },
  format: {
    title: 'Kod biçimi tanınmadı.',
    detail: 'Takip kodunu TK-AB12CD34EF56AB78 benzeri biçimde girin.',
  },
  lowercase: {
    title: 'Kod küçük harflerle girildi.',
    detail: 'Kod otomatik olarak büyük harfe çevrilir, ancak başındaki TK- bölümünü ve toplam uzunluğu kontrol edin.',
  },
};

export default async function TrackPage({ params, searchParams }: { params: Promise<{ tenantSlug: string }>; searchParams: Promise<{ error?: string }> }) {
  const { tenantSlug } = await params;
  const { error } = await searchParams;
  const errorMessage = error ? (errorCopy[error] ?? errorCopy.format) : null;
  const action = trackTicketAction.bind(null, tenantSlug);

  return (
    <main className="wrap">
      <form action={action} className="card" style={{ maxWidth: 720 }} noValidate>
        <p style={{ color: 'var(--muted)', fontWeight: 700 }}>{tenantSlug} - Başvuru takibi</p>
        <h1>Takip kodunuzu girin.</h1>
        {errorMessage ? (
          <div className="notice error" role="alert" id="trackingToken-error">
            <strong>{errorMessage.title}</strong>
            <p>{errorMessage.detail}</p>
          </div>
        ) : null}
        <div className={`field ${error ? 'field-error' : ''}`}>
          <label htmlFor="trackingToken">Takip kodu</label>
          <input
            id="trackingToken"
            name="trackingToken"
            aria-label="Takip kodu"
            placeholder="TK-1A2B3C4D5E6F7A8B"
            aria-describedby={errorMessage ? 'trackingToken-help trackingToken-error' : 'trackingToken-help'}
            aria-invalid={Boolean(error)}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            maxLength={19}
          />
          <small id="trackingToken-help">Başvurular yalnızca size verilen gizli takip koduyla sorgulanır.</small>
        </div>
        <button className="cta" type="submit">Durumu sorgula</button>
      </form>
    </main>
  );
}
