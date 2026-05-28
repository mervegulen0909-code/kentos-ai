import { resetPasswordAction } from './actions';

const errorMessages: Record<string, string> = {
  'token-missing': 'Gecersiz veya eksik sifre sifirlama baglantisi.',
  'too-short': 'Sifre en az 8 karakter olmali.',
  'mismatch': 'Sifreler eslesmiyor.',
  'failed': 'Sifre sifirlama basarisiz. Baglanti suresi dolmus olabilir; lutfen tekrar istekte bulunun.',
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? '';
  const error = params.error ?? null;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: '2rem' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>Sifre Sifirlama</h1>
        <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
          Yeni sifrenizi belirleyin. En az 8 karakter olmali.
        </p>

        {!token && !error ? (
          <div className="notice error" role="alert">
            <strong>Gecersiz baglanti.</strong>
            <p>Bu sayfa dogrudan acilmamali. Sifre sifirlama e-postanizdan gelen baglantiya tiklayin.</p>
          </div>
        ) : null}

        {error ? (
          <div className="notice error" role="alert" style={{ marginBottom: '1rem' }}>
            {errorMessages[error] ?? 'Bilinmeyen hata.'}
          </div>
        ) : null}

        {token ? (
          <form action={resetPasswordAction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="hidden" name="token" value={token} />
            <label>
              Yeni Sifre
              <input
                type="password"
                name="newPassword"
                required
                minLength={8}
                placeholder="En az 8 karakter"
                autoComplete="new-password"
              />
            </label>
            <label>
              Sifre Tekrar
              <input
                type="password"
                name="confirmPassword"
                required
                minLength={8}
                placeholder="Sifrenizi tekrar girin"
                autoComplete="new-password"
              />
            </label>
            <button type="submit" style={{ marginTop: '0.5rem' }}>Sifremi Guncelle</button>
          </form>
        ) : null}

        <p style={{ marginTop: '1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
          <a href="/login">Giris sayfasina don</a>
        </p>
      </div>
    </main>
  );
}
