import { adminApi, type TicketListItem } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';
import { AdminShell } from '../components/admin-shell';

const fallbackRows: TicketListItem[] = [];

const slaCopy: Record<string, string> = {
  OK: 'SLA icinde',
  DUE_SOON: 'SLA yaklasmakta',
  BREACHED: 'SLA asildi',
  UNKNOWN: 'SLA bilinmiyor',
};

function groupByDepartment(rows: TicketListItem[]) {
  return rows.reduce<Record<string, { total: number; dueSoon: number; breached: number }>>((acc, ticket) => {
    const key = ticket.department?.name ?? 'Atanmamis';
    acc[key] ??= { total: 0, dueSoon: 0, breached: 0 };
    acc[key].total += 1;
    if (ticket.slaState === 'DUE_SOON') acc[key].dueSoon += 1;
    if (ticket.slaState === 'BREACHED') acc[key].breached += 1;
    return acc;
  }, {});
}

export default async function QueuesPage() {
  const session = await resolveAdminSession();
  const hasSession = Boolean(session);
  const token = session?.accessToken ?? null;
  const role = session?.user.role ?? null;
  let dataUnavailable = false;

  const rows = token
    ? await adminApi.tickets(token).catch(() => {
        dataUnavailable = true;
        return fallbackRows;
      })
    : fallbackRows;

  const departments = Object.entries(groupByDepartment(rows)).sort(([, a], [, b]) => b.total - a.total);
  const breached = rows.filter((ticket) => ticket.slaState === 'BREACHED');
  const dueSoon = rows.filter((ticket) => ticket.slaState === 'DUE_SOON');

  return (
    <AdminShell hasSession={hasSession} role={role}>
        <p className="badge">Birim kuyruklari - SLA ve is yuku</p>
        <h1>Departman operasyon yogunlugu</h1>
        {!hasSession ? (
          <div className="notice muted" role="note">
            <strong>Canli kuyruk icin oturum gerekli.</strong>
            <p>Birim yogunlugu, bekleyen isler ve SLA alarmi yetkili oturumla API'den okunur.</p>
          </div>
        ) : null}
        {dataUnavailable ? (
          <div className="notice error" role="alert">
            <strong>Kuyruk verisi alinamadi.</strong>
            <p>Teknik hata ayrintisi gizlendi. Baglanti, oturum veya tenant yetkisini kontrol edin.</p>
          </div>
        ) : null}
        <section className="grid" aria-label="Kuyruk KPI kartlari">
          <article className="card">
            <p>Bekleyen isler</p>
            <p className="kpi">{rows.length}</p>
            <p style={{ color: 'var(--muted)' }}>Acik operasyon kuyrugundaki kayitlar.</p>
          </article>
          <article className="card">
            <p>SLA alarmi</p>
            <p className="kpi" style={{ color: breached.length ? 'var(--danger)' : 'var(--accent)' }}>{breached.length}</p>
            <p style={{ color: 'var(--muted)' }}>Suresi asilmis ve eskalasyon bekleyen isler.</p>
          </article>
          <article className="card">
            <p>Yaklasan SLA</p>
            <p className="kpi">{dueSoon.length}</p>
            <p style={{ color: 'var(--muted)' }}>Onceliklendirme isteyen yakin riskler.</p>
          </article>
        </section>
        <section className="card" style={{ marginTop: 18 }}>
          <h2>Birim yogunlugu</h2>
          {departments.length ? (
            <div className="responsive-list">
              {departments.map(([department, summary]) => (
                <div className="queue-row" key={department}>
                  <strong>{department}</strong>
                  <span>{summary.total} acik is</span>
                  <span>{summary.dueSoon} yaklasan SLA</span>
                  <span>{summary.breached} SLA asimi</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>Henuz kuyruk verisi yok.</strong>
              <p>Vatandas basvurulari birimlere atandiginda toplam is yuku, SLA yaklasan isler ve asim riski burada listelenecek.</p>
            </div>
          )}
        </section>
        <section className="card" style={{ marginTop: 18 }}>
          <h2>SLA oncelik kuyrugu</h2>
          {breached.concat(dueSoon).length ? (
            <div className="responsive-list">
              {breached.concat(dueSoon).map((ticket) => (
                <a className="queue-row" href={`/tickets/${ticket.id}`} key={ticket.id}>
                  <strong>{ticket.ticketNo}</strong>
                  <span>{ticket.title}</span>
                  <span>{ticket.department?.name ?? 'Atanmamis'}</span>
                  <span>{slaCopy[ticket.slaState ?? 'UNKNOWN'] ?? slaCopy.UNKNOWN}</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>SLA alarmi yok.</strong>
              <p>Su an asim veya yaklasan sure riski gorunmuyor; yeni riskler olustugunda bu liste oncelik sirasiyla dolar.</p>
            </div>
          )}
        </section>
    </AdminShell>
  );
}
