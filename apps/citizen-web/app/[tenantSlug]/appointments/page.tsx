import { notFound } from 'next/navigation';
import { citizenApi } from '../../../lib/api';
import { bookAppointmentAction } from './actions';

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const errorCopy: Record<string, string> = {
  missing: 'Ad ve slot seçimi zorunludur.',
  failed: 'Randevu alınamadı. Slot dolmuş olabilir, lütfen başka bir zaman seçin.',
};

export default async function AppointmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ error?: string; booked?: string }>;
}) {
  const { tenantSlug } = await params;
  const { error, booked } = await searchParams;

  const slots = await citizenApi.availableSlots(tenantSlug).catch(() => null);
  if (slots === null) return notFound();

  const boundAction = bookAppointmentAction.bind(null, tenantSlug);

  return (
    <main className="wrap" style={{ maxWidth: 720 }}>
      <p style={{ color: 'var(--muted)', fontWeight: 700 }}>{tenantSlug} · E-Randevu</p>
      <h1>Randevu Al</h1>

      {booked ? (
        <div className="notice" style={{ background: 'var(--success-muted, #d1fae5)', borderColor: 'var(--success, #10b981)', marginBottom: '1.5rem' }} role="status">
          <strong>Randevunuz alındı!</strong>
          <p>Randevu kodunuz: <code>{booked.slice(0, 8).toUpperCase()}</code></p>
          <p>Bilgilendirme için telefonunuzu yanınızda bulundurun.</p>
        </div>
      ) : null}

      {error ? (
        <div className="notice error" role="alert" style={{ marginBottom: '1.5rem' }}>
          {errorCopy[error] ?? 'Bir hata oluştu.'}
        </div>
      ) : null}

      {slots.length === 0 ? (
        <div className="card">
          <p>Şu an müsait randevu slotu bulunmuyor. Lütfen daha sonra tekrar kontrol edin.</p>
          <a href={`/${tenantSlug}/report`}>Başvuru oluşturun →</a>
        </div>
      ) : (
        <form action={boundAction} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} noValidate>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Zaman seçin</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 320, overflowY: 'auto' }}>
              {slots.map((s) => {
                const remaining = s.capacity - s.booked;
                return (
                  <label key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem', border: '1px solid var(--card-border)',
                    borderRadius: 8, cursor: 'pointer',
                  }}>
                    <input type="radio" name="slotId" value={s.id} required />
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: '0.9rem' }}>{fmtDt(s.startsAt)}</strong>
                      {s.departmentName ? <span style={{ color: 'var(--muted)', marginLeft: '0.5rem', fontSize: '0.8rem' }}>· {s.departmentName}</span> : null}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: remaining <= 2 ? 'var(--warning, #f59e0b)' : 'var(--muted)' }}>
                      {remaining} yer kaldı
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <label style={{ display: 'grid', gap: '0.4rem' }}>
            <span style={{ fontWeight: 600 }}>Ad Soyad <span style={{ color: 'var(--danger)' }}>*</span></span>
            <input name="citizenName" required placeholder="Ahmet Yılmaz" autoComplete="name" />
          </label>

          <label style={{ display: 'grid', gap: '0.4rem' }}>
            <span style={{ fontWeight: 600 }}>Telefon</span>
            <input name="citizenPhone" type="tel" placeholder="05xx xxx xx xx" autoComplete="tel" />
          </label>

          <label style={{ display: 'grid', gap: '0.4rem' }}>
            <span style={{ fontWeight: 600 }}>Not (isteğe bağlı)</span>
            <textarea name="note" rows={2} placeholder="Randevuyla ilgili eklemek istediğiniz..." />
          </label>

          <button type="submit" style={{ marginTop: '0.5rem' }}>Randevuyu Onayla</button>
        </form>
      )}
    </main>
  );
}
