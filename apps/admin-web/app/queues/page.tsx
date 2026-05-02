import { adminApi, type TicketListItem } from '../../lib/api';
import { getSessionToken } from '../../lib/session';

const fallbackRows: TicketListItem[] = [];

const slaCopy: Record<string, string> = {
  OK: 'SLA içinde',
  DUE_SOON: 'SLA yaklaşmakta',
  BREACHED: 'SLA aşıldı',
  UNKNOWN: 'SLA bilinmiyor',
};

function groupByDepartment(rows: TicketListItem[]) {
  return rows.reduce<Record<string, { total: number; dueSoon: number; breached: number }>>((acc, ticket) => {
    const key = ticket.department?.name ?? 'Atanmamış';
    acc[key] ??= { total: 0, dueSoon: 0, breached: 0 };
    acc[key].total += 1;
    if (ticket.slaState === 'DUE_SOON') acc[key].dueSoon += 1;
    if (ticket.slaState === 'BREACHED') acc[key].breached += 1;
    return acc;
  }, {});
}

export default async function QueuesPage() {
  const token = await getSessionToken();
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
    <main className="main">
      <p className="badge">Birim kuyrukları · SLA ve iş yükü</p>
      <h1>Departman operasyon yoğunluğu</h1>
      {!token ? (
        <div className="notice muted" role="note">
          <strong>Canlı kuyruk için oturum gerekli.</strong>
          <p>Birim yoğunluğu, bekleyen işler ve SLA alarmı yetkili oturumla API’den okunur.</p>
        </div>
      ) : null}
      {dataUnavailable ? (
        <div className="notice error" role="alert">
          <strong>Kuyruk verisi alınamadı.</strong>
          <p>Teknik hata ayrıntısı gizlendi. Bağlantı, oturum veya tenant yetkisini kontrol edin.</p>
        </div>
      ) : null}
      <section className="grid" aria-label="Kuyruk KPI kartları">
        <article className="card">
          <p>Bekleyen işler</p>
          <p className="kpi">{rows.length}</p>
          <p style={{ color: 'var(--muted)' }}>Açık operasyon kuyruğundaki kayıtlar.</p>
        </article>
        <article className="card">
          <p>SLA alarmı</p>
          <p className="kpi" style={{ color: breached.length ? 'var(--danger)' : 'var(--accent)' }}>{breached.length}</p>
          <p style={{ color: 'var(--muted)' }}>Süresi aşılmış ve eskalasyon bekleyen işler.</p>
        </article>
        <article className="card">
          <p>Yaklaşan SLA</p>
          <p className="kpi">{dueSoon.length}</p>
          <p style={{ color: 'var(--muted)' }}>Önceliklendirme isteyen yakın riskler.</p>
        </article>
      </section>
      <section className="card" style={{ marginTop: 18 }}>
        <h2>Birim yoğunluğu</h2>
        {departments.length ? (
          <div className="responsive-list">
            {departments.map(([department, summary]) => (
              <div className="queue-row" key={department}>
                <strong>{department}</strong>
                <span>{summary.total} açık iş</span>
                <span>{summary.dueSoon} yaklaşan SLA</span>
                <span>{summary.breached} SLA aşımı</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>Henüz kuyruk verisi yok.</strong>
            <p>Vatandaş başvuruları birimlere atandığında toplam iş yükü, SLA yaklaşan işler ve aşım riski burada listelenecek.</p>
          </div>
        )}
      </section>
      <section className="card" style={{ marginTop: 18 }}>
        <h2>SLA öncelik kuyruğu</h2>
        {breached.concat(dueSoon).length ? (
          <div className="responsive-list">
            {breached.concat(dueSoon).map((ticket) => (
              <a className="queue-row" href={`/tickets/${ticket.id}`} key={ticket.id}>
                <strong>{ticket.ticketNo}</strong>
                <span>{ticket.title}</span>
                <span>{ticket.department?.name ?? 'Atanmamış'}</span>
                <span>{slaCopy[ticket.slaState ?? 'UNKNOWN'] ?? slaCopy.UNKNOWN}</span>
              </a>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>SLA alarmı yok.</strong>
            <p>Şu an aşım veya yaklaşan süre riski görünmüyor; yeni riskler oluştuğunda bu liste öncelik sırasıyla dolar.</p>
          </div>
        )}
      </section>
    </main>
  );
}
