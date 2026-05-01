import { adminApi } from '../../lib/api';
import { getSessionToken } from '../../lib/session';

const fallbackRows = [
  { id: 'demo-1', ticketNo: 'KNT-2026-000123', title: 'Kaldırım çökmesi', department: { name: 'Fen İşleri' }, status: 'ASSIGNED', slaState: 'DUE_SOON' },
  { id: 'demo-2', ticketNo: 'KNT-2026-000124', title: 'Konteyner taşması', department: { name: 'Temizlik İşleri' }, status: 'IN_PROGRESS', slaState: 'BREACHED' },
  { id: 'demo-3', ticketNo: 'KNT-2026-000125', title: 'Park aydınlatması', department: { name: 'Park ve Bahçeler' }, status: 'NEW', slaState: 'OK' },
];

export default async function TicketsPage() {
  const token = await getSessionToken();
  const rows = token ? await adminApi.tickets(token).catch(() => fallbackRows) : fallbackRows;

  return (
    <main className="main">
      <p className="badge">Talepler · filtrelenebilir operasyon kuyruğu</p>
      <h1>Tüm başvurular</h1>
      {!token ? <p style={{ color: 'var(--muted)' }}>Gerçek veriler için giriş yapın. Şu an demo kuyruk gösteriliyor.</p> : null}
      <section className="card">
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((ticket) => (
            <a key={ticket.id} href={`/tickets/${ticket.id}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr 1fr 1fr', gap: 12, padding: 14, border: '1px solid var(--line)', borderRadius: 14 }}>
              <strong>{ticket.ticketNo}</strong>
              <span>{ticket.title}</span>
              <span>{ticket.department?.name ?? 'Atanmamış'}</span>
              <span>{ticket.status}</span>
              <span>{ticket.slaState ?? 'UNKNOWN'}</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
