import { adminApi } from '../../lib/api';
import { getSessionToken } from '../../lib/session';

const fallbackRows: Array<{
  id: string;
  ticketNo: string;
  title: string;
  department?: { name: string } | null;
  status: string;
  slaState?: string;
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

export default async function TicketsPage() {
  const token = await getSessionToken();
  let dataUnavailable = false;
  const rows = token
    ? await adminApi.tickets(token).catch(() => {
        dataUnavailable = true;
        return fallbackRows;
      })
    : fallbackRows;

  return (
    <main className="main">
      <p className="badge">Talepler · filtrelenebilir operasyon kuyrugu</p>
      <h1>Tum basvurular</h1>
      {!token ? <p className="notice muted">Gercek veriler icin giris yapin. Bu liste artik demo token yerine session cookie akisina dayaniyor.</p> : null}
      {dataUnavailable ? <p className="notice error" role="alert">Canli kuyruk alinamadi; ekran bos durumla ayakta tutuluyor.</p> : null}
      <section className="card">
        <div className="ticket-list">
          {rows.length ? rows.map((ticket) => (
            <a key={ticket.id} href={`/tickets/${ticket.id}`} className="ticket-list-row">
              <strong>{ticket.ticketNo}</strong>
              <span><span className="ticket-list-label">Baslik</span>{ticket.title}</span>
              <span><span className="ticket-list-label">Birim</span>{ticket.department?.name ?? 'Atanmamis'}</span>
              <span><span className="ticket-list-label">Durum</span>{statusCopy[ticket.status] ?? ticket.status}</span>
              <span><span className="ticket-list-label">SLA</span>{slaCopy[ticket.slaState ?? 'UNKNOWN'] ?? slaCopy.UNKNOWN}</span>
            </a>
          )) : (
            <div className="empty-state">
              <strong>Acik basvuru yok.</strong>
              <p>Filtrelenebilir operasyon kuyrugu hazir; yeni vatandas basvurulari dustugunde burada listelenecek.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
