import { loginAction } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="main" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <form action={loginAction} className="card" style={{ width: 'min(440px, 100%)' }}>
        <p className="badge">KentOS AI · Yetkili giriş</p>
        <h1>Operasyon paneline giriş</h1>
        {error ? (
          <p role="alert" style={{ color: 'var(--danger)' }}>
            {error === 'missing' ? 'Tüm alanları doldurun.' : 'Giriş bilgileri doğrulanamadı.'}
          </p>
        ) : null}
        <label style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
          Belediye kodu
          <input name="tenantSlug" defaultValue="demo-belediye" autoComplete="organization" />
        </label>
        <label style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
          E-posta
          <input name="email" type="email" defaultValue="admin@demo.local" autoComplete="email" />
        </label>
        <label style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
          Şifre
          <input name="password" type="password" autoComplete="current-password" placeholder="ChangeMe123!" />
        </label>
        <button type="submit" style={{ minHeight: 48, borderRadius: 999, border: 0, padding: '0 18px', background: 'var(--accent)' }}>
          Güvenli giriş yap
        </button>
      </form>
    </main>
  );
}
