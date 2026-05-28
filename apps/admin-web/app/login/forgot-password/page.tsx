import { requestPasswordResetAction } from './actions';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: '2rem' }}>
        <p className="badge">KentOS AI · sifre sifirlama</p>
        <h1>Sifremi Unuttum</h1>

        {params.sent ? (
          <div className="notice" style={{ background: 'var(--accent-muted)', borderColor: 'var(--accent)', marginBottom: '1rem' }}>
            <strong>E-posta gonderildi.</strong>
            <p>Kayitli e-posta adresinize sifre sifirlama baglantisi gonderdik. 1 saat icinde gecerlidir.</p>
          </div>
        ) : (
          <>
            <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
              Hesabinizla iliskilendirilmis e-posta adresinizi girin. Sifre sifirlama baglantisi gondereceğiz.
            </p>

            {params.error === 'invalid-email' ? (
              <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Gecerli bir e-posta adresi girin.</p>
            ) : null}

            <form action={requestPasswordResetAction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label>
                E-posta adresi
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="ornek@belediye.gov.tr"
                  autoComplete="email"
                />
              </label>
              <button type="submit">Sifirlama Baglantisi Gonder</button>
            </form>
          </>
        )}

        <p style={{ marginTop: '1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
          <a href="/login">Giris sayfasina don</a>
        </p>
      </div>
    </main>
  );
}
