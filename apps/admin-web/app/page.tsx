import { adminApi } from '../lib/api';

const fallbackOverview = { totalOpen: 128, slaBreached: 17, resolvedToday: 42 };
const fallbackTickets = [
  { ticketNo: 'KNT-2026-000123', title: 'Kaldırım çökmesi', department: { name: 'Fen İşleri' }, slaState: 'DUE_SOON', status: 'ASSIGNED' },
  { ticketNo: 'KNT-2026-000124', title: 'Konteyner taşması', department: { name: 'Temizlik İşleri' }, slaState: 'BREACHED', status: 'IN_PROGRESS' },
  { ticketNo: 'KNT-2026-000125', title: 'Sokak aydınlatması', department: { name: 'Ulaşım' }, slaState: 'OK', status: 'NEW' },
];

const statusCopy: Record<string, string> = {
  NEW: 'Yeni kayıt',
  TRIAGED: 'Ön incelemede',
  ASSIGNED: 'Birime atandı',
  IN_PROGRESS: 'İşlemde',
  WAITING_INFO: 'Bilgi bekleniyor',
  RESOLVED: 'Çözüm bildirildi',
  CLOSED: 'Kapatıldı',
  REJECTED: 'Reddedildi',
};

const slaCopy: Record<string, string> = {
  OK: 'SLA içinde',
  DUE_SOON: 'SLA yaklaşmakta',
  BREACHED: 'SLA aşıldı',
  UNKNOWN: 'SLA bilinmiyor',
};

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
        <p className="badge">Demo Belediyesi · Rol ve SLA odaklı operasyon özeti</p>
        <h2 style={{ fontSize: 'clamp(2.8rem, 8vw, 7rem)', lineHeight: .9, letterSpacing: '-.06em', maxWidth: 900 }}>
          Yetkili ekiplerin talep yükü, SLA alarmı ve RBAC kapsamı tek ekranda.
        </h2>
        <div className="notice muted" role="note">
          <strong>Canlı veriler rol ve tenant yetkisine göre okunur.</strong>
          <p>Yetkisiz veya READ_ONLY oturumlarda mutasyonlar backend guard tarafından reddedilir; dashboard ham API hatası göstermez.</p>
        </div>
        <div className="grid">
          <article className="card"><p>Yetkili kuyruk yükü</p><p className="kpi">{overview.totalOpen}</p><p style={{ color: 'var(--muted)' }}>Rol kapsamınızda görünen açık başvurular.</p></article>
          <article className="card"><p>SLA aşımı</p><p className="kpi" style={{ color: 'var(--danger)' }}>{overview.slaBreached}</p><p style={{ color: 'var(--muted)' }}>Yönetici takibi isteyen süre ihlalleri.</p></article>
          <article className="card"><p>Bugün sonuçlanan</p><p className="kpi">{overview.resolvedToday}</p><p style={{ color: 'var(--muted)' }}>Çözüm bildirilen veya kapanışa hazır kayıtlar.</p></article>
        </div>
        <section className="card" style={{ marginTop: 18 }}>
          <h3>Öncelikli kuyruk</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {tickets.map((ticket) => (
              <div className="queue-row" key={ticket.ticketNo}>
                <strong>{ticket.ticketNo}</strong>
                <span>{ticket.title}</span>
                <span>{ticket.department?.name ?? 'Atanmamış'}</span>
                <span>{slaCopy[ticket.slaState ?? 'UNKNOWN'] ?? slaCopy.UNKNOWN} · {statusCopy[ticket.status] ?? ticket.status}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
