import { adminApi } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';
import { AdminShell } from '../components/admin-shell';
import { createSinkAction, deleteSinkAction, toggleSinkAction } from './actions';

export default async function ChannelsPage() {
  const session = await resolveAdminSession();
  const token = session?.accessToken ?? null;
  const role = session?.user.role ?? null;

  const sinks = token ? await adminApi.notificationSinks(token).catch(() => []) : [];

  return (
    <AdminShell hasSession={Boolean(token)} role={role}>
      <p className="badge">Kanal Ayarlari · bildirim entegrasyonlari</p>
      <h1>Kanal Ayarlari</h1>
      <p style={{ color: 'var(--muted)' }}>
        Slack ve Microsoft Teams kanallarini entegre ederek yeni ticket ve cozum bildirimlerini otomatik olarak iletin.
      </p>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Yeni Bildirim Kanali Ekle</h2>
        <form action={createSinkAction} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label>
              Ad
              <input name="name" required placeholder="Ornegin: Acil Durumlar Slack" style={{ width: 200 }} />
            </label>
            <label>
              Tip
              <select name="type" defaultValue="SLACK">
                <option value="SLACK">Slack</option>
                <option value="TEAMS">Microsoft Teams</option>
              </select>
            </label>
          </div>
          <label>
            Webhook URL
            <input name="webhookUrl" required type="url" placeholder="https://hooks.slack.com/services/..." />
          </label>
          <label>
            Olaylar (virgullu)
            <input name="events" defaultValue="ticket.created,ticket.resolved" placeholder="ticket.created,ticket.resolved,ticket.mention" />
          </label>
          <button type="submit" style={{ alignSelf: 'flex-start' }}>Kanal Ekle</button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Aktif Kanallar</h2>
        {sinks.length === 0 ? (
          <p className="muted">Henuz bildirim kanali eklenmemis.</p>
        ) : (
          <div className="responsive-list">
            {sinks.map((s) => (
              <div className="queue-row" key={s.id}>
                <div style={{ flex: 1 }}>
                  <strong>{s.name}</strong>
                  <span style={{ color: 'var(--muted)', marginLeft: '0.5rem', fontSize: '0.8rem' }}>{s.type}</span>
                  <br />
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{s.webhookUrl.slice(0, 60)}...</span>
                </div>
                <span style={{ fontSize: '0.8rem', color: s.isActive ? 'var(--accent)' : 'var(--muted)' }}>
                  {s.isActive ? 'Aktif' : 'Pasif'}
                </span>
                <form action={toggleSinkAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="isActive" value={String(s.isActive)} />
                  <button type="submit" style={{ fontSize: '0.75rem' }}>
                    {s.isActive ? 'Durdur' : 'Etkinlestir'}
                  </button>
                </form>
                <form action={deleteSinkAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>Sil</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>E-posta Kanalı (Postmark Inbound)</h2>
        <p style={{ color: 'var(--muted)' }}>
          Postmark inbound webhook aktif. Gelen e-postalar otomatik ticket olusturur.
        </p>
        <p style={{ fontSize: '0.85rem', fontFamily: 'monospace', background: 'var(--card-border)', padding: '0.5rem 0.75rem', borderRadius: 6 }}>
          POST /[tenantSlug]/webhooks/postmark
        </p>
        <h2 style={{ marginTop: 16 }}>Telegram Kanali</h2>
        <p style={{ color: 'var(--muted)' }}>
          Telegram bot webhook aktif. Bot mesajlari otomatik ticket olusturur.
        </p>
        <p style={{ fontSize: '0.85rem', fontFamily: 'monospace', background: 'var(--card-border)', padding: '0.5rem 0.75rem', borderRadius: 6 }}>
          POST /[tenantSlug]/webhooks/telegram
        </p>
      </section>
    </AdminShell>
  );
}
