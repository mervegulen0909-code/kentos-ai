import { cookies } from 'next/headers';
import { createReportAction } from './actions';
import { LogoutButton } from './logout-button';
import { ReportLocationPicker } from './report-location-picker';

type CitizenSession = { citizenId: string; displayName: string | null; email: string | null; phone: string | null } | null;

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

const errorCopy: Record<string, { title: string; detail: string }> = {
  description: {
    title: 'Açıklama biraz kısa kaldı.',
    detail: 'En az 10 karakter yazın; ne olduğunu, nerede olduğunu ve ekip gelince neye bakması gerektiğini bir cümleyle anlatmanız yeterli.',
  },
  phone: {
    title: 'Telefon numarası doğrulanamadı.',
    detail: 'Telefonu yalnızca rakamlarla ya da +90 ile başlayacak biçimde girin. Boş bırakmanız da mümkündür.',
  },
  email: {
    title: 'E-posta adresi doğrulanamadı.',
    detail: 'Geçerli bir e-posta biçimi girin ya da alanı boş bırakın.',
  },
  api: {
    title: 'Başvuruyu şu an alamadık.',
    detail: 'Teknik hata ayrıntısını göstermiyoruz. Bilgileriniz ekranda duruyor; bağlantınızı kontrol edip biraz sonra yeniden gönderin.',
  },
};

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ error?: string; field?: string; draft?: string; source?: string }>;
}) {
  const { tenantSlug } = await params;
  const { error, field, draft, source } = await searchParams;
  const errorMessage = error ? (errorCopy[error] ?? errorCopy.api) : null;
  const action = createReportAction.bind(null, tenantSlug);
  const session = await getCitizenSession(tenantSlug);
  const normalizedDraft = typeof draft === 'string' ? draft.trim() : '';
  const assistantPreviewSource = source === 'assistant-preview';

  return (
    <main className="wrap">
      <section className="hero">
        <div className="card report-header-card">
          <div>
            <p className="eyebrow">{tenantSlug} · Yeni başvuru</p>
            <h1 className="display">Talebinizi belediyeye iletin.</h1>
            <p className="lede">Gönderim başarılı olursa gizli takip kodunuzun olduğu güvenli sayfaya yönlendirileceksiniz.</p>
          </div>
          <div className="report-steps" aria-label="Başvuru akışı">
            <div className="report-step"><strong>1 · Anlatın</strong><span>Ne oldu, nerede oldu, ekip neye baksın?</span></div>
            <div className="report-step"><strong>2 · Kayda alın</strong><span>Sistem talebi güvenli TK koduyla oluşturur.</span></div>
            <div className="report-step"><strong>3 · Takip edin</strong><span>Durumu vatandaş ekranından izleyin.</span></div>
          </div>
        </div>
        <form action={action} className="card report-card">
          {session ? (
            <div className="notice" role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <strong>{session.displayName ?? session.email ?? session.phone ?? 'Vatandaş'}</strong> olarak giriş yapıldı.
              </span>
              <span style={{ display: 'flex', gap: '1rem' }}>
                <a href={`/${tenantSlug}/account`} style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  Hesabım
                </a>
                <LogoutButton tenantSlug={tenantSlug} />
              </span>
            </div>
          ) : (
            <div className="notice" role="note">
              <a href={`/${tenantSlug}/login?redirect=/${tenantSlug}/report`}>
                Google veya telefon ile giriş yapın
              </a>
              {' '}— başvurularınızı daha sonra takip edebilirsiniz.
            </div>
          )}
          {assistantPreviewSource ? (
            <div className="notice" role="status">
              <strong>Asistan önizlemesinden geldiniz.</strong>
              <p>İlk mesajınız forma taşındı. Gerekirse açıklamayı netleştirip resmi başvuruyu oluşturun.</p>
            </div>
          ) : null}
          {errorMessage ? (
            <div className="notice error" role="alert">
              <strong>{errorMessage.title}</strong>
              <p>{errorMessage.detail}</p>
            </div>
          ) : null}
          <div className={`field ${field === 'description' ? 'field-error' : ''}`}>
            <label htmlFor="description">Açıklama</label>
            <textarea
              id="description"
              name="description"
              rows={6}
              placeholder="Örn. Kaldırım taşları yerinden çıkmış, bebek arabası geçemiyor."
              required
              minLength={10}
              aria-describedby="description-help"
              aria-invalid={field === 'description'}
              defaultValue={normalizedDraft}
            />
            <small id="description-help">En az 10 karakter yazın; mahalle, sokak veya ayırt edici bir nokta eklerseniz ekip daha hızlı yönlenir.</small>
          </div>
          <div className="field">
            <label htmlFor="addressText">Adres veya konum tarifi</label>
            <input id="addressText" name="addressText" placeholder="Mahalle, sokak, bina önü veya yakınındaki bilinen nokta" autoComplete="street-address" />
          </div>
          <ReportLocationPicker />
          <div className="field">
            <label htmlFor="displayName">Ad soyad</label>
            <input id="displayName" name="displayName" placeholder="İsteğinize bağlı" autoComplete="name" defaultValue={session?.displayName ?? ''} />
          </div>
          <div className={`field ${field === 'phone' ? 'field-error' : ''}`}>
            <label htmlFor="phone">Telefon</label>
            <input id="phone" name="phone" placeholder="+905551112233" autoComplete="tel" inputMode="tel" aria-invalid={field === 'phone'} aria-describedby="phone-help" defaultValue={session?.phone ?? ''} />
            <small id="phone-help">İsteğe bağlıdır. Girerseniz belediye gerektiğinde sizi arayabilir.</small>
          </div>
          <div className={`field ${field === 'email' ? 'field-error' : ''}`}>
            <label htmlFor="email">E-posta</label>
            <input id="email" name="email" type="email" placeholder="ornek@posta.com" autoComplete="email" aria-invalid={field === 'email'} aria-describedby="email-help" defaultValue={session?.email ?? ''} />
            <small id="email-help">İsteğe bağlıdır. Girerseniz süreç güncellemeleri bu kanaldan da paylaşılabilir.</small>
          </div>
          <div className="field">
            <label htmlFor="attachment">Foto veya belge</label>
            <input id="attachment" name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" />
            <small>Istege baglidir. Fotograf, PDF veya kisa metin dosyasi ekleyebilirsiniz.</small>
          </div>
          <button className="cta" type="submit">Başvuruyu oluştur</button>
        </form>
      </section>

      {/* Hızlı erişim bağlantıları */}
      <nav style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.5rem', padding: '0 0.5rem' }}>
        <a href={`/${tenantSlug}/track`} style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>📋 Başvuru Takibi</a>
        <a href={`/${tenantSlug}/faq`} style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>❓ Bilgi Bankası</a>
        <a href={`/${tenantSlug}/appointments`} style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>📅 E-Randevu</a>
      </nav>
    </main>
  );
}
