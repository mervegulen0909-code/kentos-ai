import { adminApi } from '../lib/api';

const fallbackOverview = { totalOpen: 128, slaBreached: 17, resolvedToday: 42 };
const fallbackTickets = [
  { ticketNo: 'KNT-2026-000123', title: 'Kaldırım çökmesi', department: { name: 'Fen İşleri' }, slaState: 'DUE_SOON', status: 'ASSIGNED' },
  { ticketNo: 'KNT-2026-000124', title: 'Konteyner taşması', department: { name: 'Temizlik İşleri' }, slaState: 'BREACHED', status: 'IN_PROGRESS' },
  { ticketNo: 'KNT-2026-000125', title: 'Sokak aydınlatması', department: { name: 'Ulaşım' }, slaState: 'OK', status: 'NEW' },
];

export default async function AdminHome() {
  const token = process.env.KENTOS_DEMO_ACCESS_TOKEN;
  const [overview, tickets] = token
    ? await Promise.all([
        adminApi.overview(token).catch(() => fallbackOverview),
        adminApi.tickets(token).catch(() => fallbackTickets),
      ])
    : [fallbackOverview, fallbackTickets];
  return (
    <main className="shell">
      <aside className="sidebar">
        <h1>KentOS AI</h1>
        <p style={{ color: 'var(--muted)' }}>Operasyon komuta paneli</p>
        <nav style={{ display: 'grid', gap: 12, marginTop: 32 }}>
          <a href="/">Dashboard</a>
          <a href="/tickets">Talepler</a>
          <a href="/queues">Birim Kuyrukları</a>
          <a href="/reports">Raporlar</a>
          <a href="/settings">Ayarlar</a>
        </nav>
      </aside>
      <section className="main">
        <p className="badge">Demo Belediyesi · Bugünkü operasyon özeti</p>
        <h2 style={{ fontSize: 'clamp(2.8rem, 8vw, 7rem)', lineHeight: .9, letterSpacing: '-.06em', maxWidth: 900 }}>
          Talep akışı, SLA riski ve birim performansı tek ekranda.
        </h2>
        <div className="grid">
          <article className="card"><p>Açık talep</p><p className="kpi">{overview.totalOpen}</p></article>
          <article className="card"><p>SLA riski</p><p className="kpi" style={{ color: 'var(--danger)' }}>{overview.slaBreached}</p></article>
          <article className="card"><p>Bugün çözülen</p><p className="kpi">{overview.resolvedToday}</p></article>
        </div>
        <section className="card" style={{ marginTop: 18 }}>
          <h3>Öncelikli kuyruk</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {tickets.map((ticket) => (
              <div key={ticket.ticketNo} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 12, padding: 14, borderTop: '1px solid var(--line)' }}>
                <strong>{ticket.ticketNo}</strong>
                <span>{ticket.title}</span>
                <span>{ticket.department?.name ?? 'Atanmamış'}</span>
                <span>{ticket.slaState ?? 'UNKNOWN'} · {ticket.status}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
