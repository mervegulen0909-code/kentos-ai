import { adminApi } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';
import { AdminShell } from '../components/admin-shell';

const statusLabels: Record<string, string> = {
  INITIATED: 'Basladi',
  TRANSCRIBED: 'Metne Donustu',
  TICKET_CREATED: 'Ticket Olusturuldu',
  FAILED: 'Basarisiz',
};

export default async function IvrPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const session = await resolveAdminSession();
  const token = session?.accessToken ?? null;
  const role = session?.user.role ?? null;

  const calls = token
    ? await adminApi.ivrCalls(token, params.status).catch(() => [])
    : [];

  return (
    <AdminShell hasSession={Boolean(token)} role={role}>
      <p className="badge">IVR · ses kanali cagrilari</p>
      <h1>IVR Cagri Kayitlari</h1>
      <p style={{ color: 'var(--muted)' }}>
        Twilio Voice araciligiyla gelen cagrilarin kayitlari ve transkriptleri.
        Aktif IVR icin <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code> ve Whisper icin <code>OPENAI_API_KEY</code> gereklidir.
      </p>

      <section className="card" style={{ marginTop: 12 }}>
        <p>
          <strong>Twilio webhook URL (voice):</strong>{' '}
          <code style={{ fontSize: '0.85rem', background: 'var(--card-border)', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
            POST /ivr/[tenantSlug]/voice
          </code>
        </p>
        <p>
          <strong>Kayit tamamlandi URL:</strong>{' '}
          <code style={{ fontSize: '0.85rem', background: 'var(--card-border)', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
            POST /ivr/[tenantSlug]/recording
          </code>
        </p>
      </section>

      {/* Status filter */}
      <form className="filter-grid" style={{ marginTop: 12 }}>
        <label>
          Durum
          <select name="status" defaultValue={params.status ?? ''}>
            <option value="">Tumu</option>
            {Object.entries(statusLabels).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <div style={{ marginTop: '1.2rem' }}><button type="submit">Filtrele</button></div>
      </form>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Cagrilar ({calls.length})</h2>
        {calls.length === 0 ? (
          <p className="muted">Cagri bulunamadi.</p>
        ) : (
          <div className="responsive-list">
            {calls.map((c) => (
              <div className="queue-row" key={c.id} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.3rem' }}>
                <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                  <strong>{c.from}</strong>
                  <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{c.to}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: c.status === 'FAILED' ? 'var(--danger)' : 'var(--accent)' }}>
                    {statusLabels[c.status] ?? c.status}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    {new Date(c.createdAt).toLocaleString('tr-TR')}
                  </span>
                </div>
                {c.transcript && (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)', background: 'var(--card-border)', padding: '0.4rem 0.6rem', borderRadius: 4, width: '100%' }}>
                    {c.transcript.slice(0, 300)}{c.transcript.length > 300 ? '...' : ''}
                  </p>
                )}
                {c.recordingUrl && (
                  <a href={c.recordingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem' }}>
                    Kaydi dinle
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
