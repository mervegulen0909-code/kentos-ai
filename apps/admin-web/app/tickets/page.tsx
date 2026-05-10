import { adminApi, type TicketListFilters, type TicketListItem } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';
import { AdminShell } from '../components/admin-shell';

const fallbackRows: TicketListItem[] = [];
const fallbackOptions: Array<{ id: string; name: string }> = [];

const ticketStatuses = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_INFO', 'RESOLVED', 'CLOSED', 'REJECTED'];

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

export default async function TicketsPage({ searchParams }: { searchParams: Promise<TicketListFilters> }) {
  const filters = await searchParams;
  const session = await resolveAdminSession();
  const token = session?.accessToken ?? null;
  const hasSession = Boolean(session);
  const role = session?.user.role ?? null;
  let dataUnavailable = false;
  const [rows, departments, categories] = token
    ? await Promise.all([
        adminApi.tickets(token, filters).catch(() => {
          dataUnavailable = true;
          return fallbackRows;
        }),
        adminApi.departments(token).catch(() => fallbackOptions),
        adminApi.categories(token).catch(() => fallbackOptions),
      ])
    : [fallbackRows, fallbackOptions, fallbackOptions];
  const activeFilterCount = ['status', 'departmentId', 'categoryId', 'assignedToId', 'q'].filter((key) => {
    const value = filters[key as keyof TicketListFilters];
    return typeof value === 'string' && value.trim();
  }).length;

  return (
    <AdminShell hasSession={hasSession} role={role}>
      <p className="badge">Talepler · filtrelenebilir operasyon kuyrugu</p>
      <h1>Tum basvurular</h1>
      {!token ? <p className="notice muted">Gercek veriler icin giris yapin. Bu liste artik demo token yerine session cookie akisina dayaniyor.</p> : null}
      {dataUnavailable ? <p className="notice error" role="alert">Canli kuyruk alinamadi; ekran bos durumla ayakta tutuluyor.</p> : null}
      <section className="card filter-card" aria-label="Talep filtreleri">
        <form className="filter-grid">
          <label>
            Arama
            <input name="q" defaultValue={filters.q ?? ''} placeholder="Ticket no, takip kodu, baslik veya adres" />
          </label>
          <label>
            Durum
            <select name="status" defaultValue={filters.status ?? ''}>
              <option value="">Tum durumlar</option>
              {ticketStatuses.map((status) => <option key={status} value={status}>{statusCopy[status] ?? status}</option>)}
            </select>
          </label>
          <label>
            Birim
            <select name="departmentId" defaultValue={filters.departmentId ?? ''}>
              <option value="">Tum birimler</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </label>
          <label>
            Kategori
            <select name="categoryId" defaultValue={filters.categoryId ?? ''}>
              <option value="">Tum kategoriler</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label>
            Atanan kullanici ID
            <input name="assignedToId" defaultValue={filters.assignedToId ?? ''} placeholder="Opsiyonel kullanici id" />
          </label>
          <div className="filter-actions">
            <button type="submit">Filtrele</button>
            <a className="button-like secondary-button" href="/tickets">Temizle</a>
          </div>
        </form>
        <p className="filter-summary">{activeFilterCount ? `${activeFilterCount} aktif filtre ile ${rows.length} kayit listeleniyor.` : `${rows.length} kayit listeleniyor.`}</p>
      </section>
      <section className="card">
        <div className="ticket-list">
          {rows.length ? rows.map((ticket) => (
            <a key={ticket.id} href={`/tickets/${ticket.id}`} className="ticket-list-row">
              <strong>{ticket.ticketNo}</strong>
              <span><span className="ticket-list-label">Baslik</span>{ticket.title}</span>
              <span><span className="ticket-list-label">Birim</span>{ticket.department?.name ?? 'Atanmamis'}</span>
              <span><span className="ticket-list-label">Durum</span>{statusCopy[ticket.status] ?? ticket.status}{ticket.assignedTo ? ` - ${ticket.assignedTo.fullName}` : ''}</span>
              <span><span className="ticket-list-label">SLA</span>{slaCopy[ticket.slaState ?? 'UNKNOWN'] ?? slaCopy.UNKNOWN}</span>
            </a>
          )) : (
            <div className="empty-state">
              <strong>Filtreyle eslesen basvuru yok.</strong>
              <p>Canli kuyruk aktif; yeni basvurular dustugunde veya filtreler genisletildiginde kayitlar burada listelenecek.</p>
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
