import { adminApi } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';
import { AdminShell } from '../components/admin-shell';
import { createSlotAction, deleteSlotAction, updateAppointmentStatusAction } from './actions';

const statusLabels: Record<string, string> = {
  PENDING: 'Bekliyor',
  CONFIRMED: 'Onaylandi',
  CANCELLED: 'Iptal',
  COMPLETED: 'Tamamlandi',
};

const statusOptions = ['CONFIRMED', 'CANCELLED', 'COMPLETED'];

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab ?? 'appointments';
  const session = await resolveAdminSession();
  const token = session?.accessToken ?? null;
  const role = session?.user.role ?? null;

  const [slots, appointments] = token
    ? await Promise.all([
        adminApi.appointmentSlots(token).catch(() => []),
        adminApi.appointments(token, params.status).catch(() => []),
      ])
    : [[], []];

  return (
    <AdminShell hasSession={Boolean(token)} role={role}>
      <p className="badge">Randevular · e-randevu sistemi</p>
      <h1>Randevu Yonetimi</h1>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: 12 }}>
        <a href="?tab=appointments" style={{ fontWeight: tab === 'appointments' ? 700 : 400 }}>Randevular</a>
        <a href="?tab=slots" style={{ fontWeight: tab === 'slots' ? 700 : 400 }}>Slotlar</a>
      </div>

      {tab === 'slots' ? (
        <>
          <section className="card" style={{ marginTop: 18 }}>
            <h2>Yeni Slot Ekle</h2>
            <form action={createSlotAction} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
              <label>
                Baslangic
                <input type="datetime-local" name="startsAt" required />
              </label>
              <label>
                Bitis
                <input type="datetime-local" name="endsAt" required />
              </label>
              <label>
                Kapasite
                <input type="number" name="capacity" defaultValue={1} min={1} max={100} style={{ width: 80 }} />
              </label>
              <button type="submit">Slot Olustur</button>
            </form>
          </section>

          <section className="card" style={{ marginTop: 18 }}>
            <h2>Slotlar ({slots.length})</h2>
            {slots.length === 0 ? (
              <p className="muted">Slot bulunamadi.</p>
            ) : (
              <div className="responsive-list">
                {slots.map((s) => (
                  <div className="queue-row" key={s.id}>
                    <span>{fmtDt(s.startsAt)}</span>
                    <span>→ {fmtDt(s.endsAt)}</span>
                    <span>{s.booked}/{s.capacity} dolu</span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{s.department?.name ?? 'Genel'}</span>
                    {s.booked === 0 ? (
                      <form action={deleteSlotAction} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={s.id} />
                        <button type="submit" style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>Sil</button>
                      </form>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Dolu — silinemez</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          {/* Status filter */}
          <form className="filter-grid" style={{ marginTop: 12 }}>
            <input type="hidden" name="tab" value="appointments" />
            <label>
              Durum
              <select name="status" defaultValue={params.status ?? ''}>
                <option value="">Tumu</option>
                {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <div style={{ marginTop: '1.2rem' }}><button type="submit">Filtrele</button></div>
          </form>

          <section className="card" style={{ marginTop: 18 }}>
            <h2>Randevular ({appointments.length})</h2>
            {appointments.length === 0 ? (
              <p className="muted">Randevu bulunamadi.</p>
            ) : (
              <div className="responsive-list">
                {appointments.map((a) => (
                  <div className="queue-row" key={a.id} style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                    <strong>{a.citizenName}</strong>
                    <span>{a.citizenPhone ?? '—'}</span>
                    <span>{fmtDt(a.slot.startsAt)}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{a.slot.department?.name ?? 'Genel'}</span>
                    <span style={{
                      fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: 4,
                      background: a.status === 'CANCELLED' ? 'var(--danger-muted)' : a.status === 'COMPLETED' ? 'var(--success-muted)' : 'var(--card-border)',
                    }}>
                      {statusLabels[a.status] ?? a.status}
                    </span>
                    <form action={updateAppointmentStatusAction} style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                      <input type="hidden" name="id" value={a.id} />
                      <select name="status" defaultValue={a.status} style={{ fontSize: '0.75rem' }}>
                        {statusOptions.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
                      </select>
                      <button type="submit" style={{ fontSize: '0.75rem' }}>Guncelle</button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
