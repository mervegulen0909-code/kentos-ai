import { adminApi, type CsatOverview } from '../lib/api';
import { canViewAnalytics, resolveAdminSession } from '../lib/session';
import { AdminShell } from './components/admin-shell';

const fallbackOverview = { totalOpen: 0, slaBreached: 0, slaDueSoon: 0, resolvedToday: 0 };
const fallbackCsat: CsatOverview = { overall: { avg: null, responseCount: 0 }, byDepartment: [], trend: [], lowScoreTickets: [] };
const fallbackTickets: Array<{
  ticketNo: string;
  title: string;
  department?: { name: string } | null;
  slaState?: string;
  status: string;
}> = [];

const statusCopy: Record<string, string> = {
  NEW: 'Yeni kayit',
  TRIAGED: 'On incelemede',
  ASSIGNED: 'Birime atandi',
  IN_PROGRESS: 'Islemde',
  WAITING_INFO: 'Bilgi bekleniyor',
  RESOLVED: 'Cozum bildirildi',
  CLOSED: 'Kapatildi',
  REJECTED: 'Reddedildi',
};

const slaCopy: Record<string, string> = {
  OK: 'SLA icinde',
  DUE_SOON: 'SLA yaklasmakta',
  BREACHED: 'SLA asildi',
  UNKNOWN: 'SLA bilinmiyor',
};

function formatCsatStars(avg: number | null) {
  if (avg === null) return '—';
  const full = Math.floor(avg);
  return '★'.repeat(full) + (avg - full >= 0.5 ? '½' : '') + ` (${avg.toFixed(1)}/5)`;
}

export default async function AdminHome() {
  const session = await resolveAdminSession();
  const hasSession = Boolean(session);
  const role = session?.user.role ?? null;
  const analyticsVisible = canViewAnalytics(role);
  const token = session?.accessToken ?? null;
  let dataUnavailable = false;

  const [overview, csat, tickets] = token
    ? await Promise.all([
        analyticsVisible
          ? adminApi.overview(token).catch(() => {
              dataUnavailable = true;
              return fallbackOverview;
            })
          : Promise.resolve(fallbackOverview),
        analyticsVisible
          ? adminApi.csat(token).catch(() => fallbackCsat)
          : Promise.resolve(fallbackCsat),
        adminApi.tickets(token).catch(() => {
          dataUnavailable = true;
          return fallbackTickets;
        }),
      ])
    : [fallbackOverview, fallbackCsat, fallbackTickets];

  return (
    <AdminShell hasSession={hasSession} role={role}>
        <p className="badge">
          {session?.user.role ? `${session.user.role} oturumu` : 'Oturum dogrulamasi bekleniyor'} - Rol ve SLA odakli operasyon ozeti
        </p>
        <h2>
          Yetkili ekiplerin talep yuku, SLA alarmi ve RBAC kapsami tek ekranda.
        </h2>
        {!hasSession ? (
          <div className="notice muted" role="note">
            <strong>Canli dashboard icin oturum gerekli.</strong>
            <p>Env token fallback kaldirildi. Bu ekran artik yalnizca session cookie ile gelen yetkili akisla calisiyor.</p>
          </div>
        ) : null}
        {hasSession && !analyticsVisible ? (
          <div className="notice muted" role="note">
            <strong>Bu rolde analytics ozeti kapali.</strong>
            <p>Dashboard kuyruk gorunumu acik kalir; rapor kartlari yalnizca yonetici rollerine sunulur.</p>
          </div>
        ) : null}
        {dataUnavailable ? (
          <div className="notice error" role="alert">
            <strong>Dashboard verisi alinamadi.</strong>
            <p>Teknik ayrinti gosterilmedi. Oturum, tenant kapsami veya API erisimini kontrol edin.</p>
          </div>
        ) : null}
        {analyticsVisible ? (
          <div className="grid">
            <article className="card"><p>Yetkili kuyruk yuku</p><p className="kpi">{overview.totalOpen}</p><p style={{ color: 'var(--muted)' }}>Rol kapsaminizda gorunen acik basvurular.</p></article>
            <article className="card"><p>SLA asimi</p><p className="kpi" style={{ color: 'var(--danger)' }}>{overview.slaBreached}</p><p style={{ color: 'var(--muted)' }}>Yonetici takibi isteyen sure ihlalleri.</p></article>
            <article className="card"><p>SLA yaklasan</p><p className="kpi" style={{ color: overview.slaDueSoon > 0 ? 'var(--warning, #e67e22)' : undefined }}>{overview.slaDueSoon}</p><p style={{ color: 'var(--muted)' }}>Son 4 saat icinde dolacak SLA'lar.</p></article>
            <article className="card"><p>Bugun sonuclanan</p><p className="kpi">{overview.resolvedToday}</p><p style={{ color: 'var(--muted)' }}>Cozum bildirilen veya kapanisa hazir kayitlar.</p></article>
            <article className="card"><p>Memnuniyet skoru</p><p className="kpi">{formatCsatStars(csat.overall.avg)}</p><p style={{ color: 'var(--muted)' }}>{csat.overall.responseCount} degerlendirme - tum zamanlar.</p></article>
            {csat.lowScoreTickets.length > 0 ? (
              <article className="card" style={{ borderColor: 'var(--danger)' }}>
                <p>Dusuk puan alanlar</p>
                <p className="kpi" style={{ color: 'var(--danger)' }}>{csat.lowScoreTickets.length}</p>
                <p style={{ color: 'var(--muted)' }}>1-2 yildiz alan son talepler — inceleme oneriliyor.</p>
              </article>
            ) : null}
          </div>
        ) : null}
        <section className="card" style={{ marginTop: 18 }}>
          <h3>Oncelikli kuyruk</h3>
          {tickets.length ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {tickets.map((ticket) => (
                <div className="queue-row" key={ticket.ticketNo}>
                  <strong>{ticket.ticketNo}</strong>
                  <span>{ticket.title}</span>
                  <span>{ticket.department?.name ?? 'Atanmamis'}</span>
                  <span>{slaCopy[ticket.slaState ?? 'UNKNOWN'] ?? slaCopy.UNKNOWN} - {statusCopy[ticket.status] ?? ticket.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>Goruntulenecek kuyruk yok.</strong>
              <p>Oturum acildiktan sonra rol kapsaminizdaki canli talepler burada listelenir.</p>
            </div>
          )}
        </section>
    </AdminShell>
  );
}
