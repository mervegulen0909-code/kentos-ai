import type { ReactNode } from 'react';
import { logoutAction } from '../login/actions';

type AdminShellProps = {
  children: ReactNode;
  hasSession?: boolean;
  role?: string | null;
};

const adminSections = [
  { href: '/', label: 'Dashboard' },
  { href: '/tickets', label: 'Talepler' },
  { href: '/handoffs', label: 'Operator devri' },
  { href: '/queues', label: 'Birim kuyruklari' },
  { href: '/reports', label: 'Raporlar' },
  { href: '/settings', label: 'Ayarlar' },
];

export function AdminShell({ children, hasSession = false, role = null }: AdminShellProps) {
  return (
    <main className="shell">
      <aside className="sidebar">
        <h1>KentOS AI</h1>
        <p style={{ color: 'var(--muted)' }}>Operasyon komuta paneli</p>
        <nav aria-label="Admin bolumleri">
          {adminSections.map((section) => (
            <a href={section.href} key={section.href}>
              {section.label}
            </a>
          ))}
          {!hasSession ? <a href="/login">Giris</a> : null}
        </nav>
        <div className="sidebar-status" role="status">
          {hasSession ? `${role ?? 'Yetkili'} oturumu` : 'Oturum bekleniyor'}
        </div>
        {hasSession ? (
          <form action={logoutAction} className="sidebar-logout">
            <button type="submit">Cikis yap</button>
          </form>
        ) : null}
      </aside>
      <section className="main">{children}</section>
    </main>
  );
}
