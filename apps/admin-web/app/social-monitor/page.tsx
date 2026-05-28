import { adminApi } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';
import { AdminShell } from '../components/admin-shell';
import { createRuleAction, deleteRuleAction, pollNowAction, toggleRuleAction } from './actions';

export default async function SocialMonitorPage() {
  const session = await resolveAdminSession();
  const token = session?.accessToken ?? null;
  const role = session?.user.role ?? null;

  const rules = token ? await adminApi.socialMonitorRules(token).catch(() => []) : [];

  return (
    <AdminShell hasSession={Boolean(token)} role={role}>
      <p className="badge">Sosyal Medya · X (Twitter) izleme</p>
      <h1>Sosyal Medya Izleme</h1>
      <p style={{ color: 'var(--muted)' }}>
        Twitter/X uzerindeki mention ve hashtagleri takip edin. Eslesen tweetler otomatik ticket olusturur.
        Aktif izleme icin <code>TWITTER_BEARER_TOKEN</code> ortam degiskeni tanimlanmali.
      </p>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Yeni Izleme Kurali</h2>
        <form action={createRuleAction} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label>
            Sorgu (Twitter arama syntax)
            <input name="query" required placeholder="#belediye OR @kentos_ai lang:tr" style={{ width: 320 }} />
          </label>
          <label>
            Platform
            <select name="platform" defaultValue="TWITTER">
              <option value="TWITTER">X (Twitter)</option>
            </select>
          </label>
          <button type="submit">Kural Ekle</button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Kurallar ({rules.length})</h2>
          <form action={pollNowAction}>
            <button type="submit">Manuel Tara</button>
          </form>
        </div>
        {rules.length === 0 ? (
          <p className="muted">Henuz izleme kurali eklenmemis.</p>
        ) : (
          <div className="responsive-list">
            {rules.map((r) => (
              <div className="queue-row" key={r.id}>
                <div style={{ flex: 1 }}>
                  <code style={{ fontSize: '0.9rem' }}>{r.query}</code>
                  <span style={{ color: 'var(--muted)', marginLeft: '0.5rem', fontSize: '0.8rem' }}>{r.platform}</span>
                </div>
                {r.lastChecked && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    Son tarama: {new Date(r.lastChecked).toLocaleString('tr-TR')}
                  </span>
                )}
                <span style={{ fontSize: '0.8rem', color: r.isActive ? 'var(--accent)' : 'var(--muted)' }}>
                  {r.isActive ? 'Aktif' : 'Pasif'}
                </span>
                <form action={toggleRuleAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="isActive" value={String(r.isActive)} />
                  <button type="submit" style={{ fontSize: '0.75rem' }}>
                    {r.isActive ? 'Durdur' : 'Etkinlestir'}
                  </button>
                </form>
                <form action={deleteRuleAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>Sil</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
