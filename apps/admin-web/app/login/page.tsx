import { redirect } from 'next/navigation';
import { PendingSubmitButton } from '../components/form-controls';
import { resolveAdminSession } from '../../lib/session';
import { loginAction } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await resolveAdminSession();
  const { error } = await searchParams;

  if (session) redirect('/');

  return (
    <main className="main" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <form action={loginAction} className="card" style={{ width: 'min(440px, 100%)' }}>
        <p className="badge">KentOS AI - Yetkili girisi</p>
        <h1>Operasyon paneline giris</h1>
        {error ? (
          <p role="alert" style={{ color: 'var(--danger)' }}>
            {error === 'missing' ? 'Tum alanlari doldurun.' : 'Giris bilgileri dogrulanamadi.'}
          </p>
        ) : null}
        <label style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
          Belediye kodu
          <input name="tenantSlug" autoComplete="organization" placeholder="belediye-kodu" />
        </label>
        <label style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
          E-posta
          <input name="email" type="email" autoComplete="email" placeholder="ornek@belediye.gov.tr" />
        </label>
        <label style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
          Sifre
          <input name="password" type="password" autoComplete="current-password" placeholder="ChangeMe123!" />
        </label>
        <PendingSubmitButton
          type="submit"
          idleLabel="Guvenli giris yap"
          pendingLabel="Giris dogrulaniyor..."
          style={{ minHeight: 48, borderRadius: 999, border: 0, padding: '0 18px', background: 'var(--accent)' }}
        />
        <p style={{ marginTop: '1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
          <a href="/login/forgot-password">Sifremi unuttum</a>
        </p>
        {error === 'reset=success' ? (
          <p role="status" style={{ color: 'var(--accent)', marginTop: '0.5rem', textAlign: 'center' }}>
            Sifreniz guncellendi. Yeni sifrenizle giris yapabilirsiniz.
          </p>
        ) : null}
      </form>
    </main>
  );
}
