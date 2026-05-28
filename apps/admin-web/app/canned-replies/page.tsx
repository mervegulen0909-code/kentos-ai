import { adminApi } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';
import { AdminShell } from '../components/admin-shell';
import { createCannedReplyAction, deleteCannedReplyAction } from './actions';

export default async function CannedRepliesPage() {
  const session = await resolveAdminSession();
  const token = session?.accessToken ?? null;
  const role = session?.user.role ?? null;

  const replies = token
    ? await adminApi.cannedReplies(token).catch(() => [])
    : [];

  return (
    <AdminShell hasSession={Boolean(token)} role={role}>
      <p className="badge">Hazir Yanitlar · sablonlar</p>
      <h1>Hazir Yanitlar</h1>
      <p style={{ color: 'var(--muted)' }}>
        Operatorlerin sikca kullandigi yanitlari sablon olarak kaydedin. Paylasilan yanitlar tum ekibe, kisisel yanitlar yalnizca size gozukur.
      </p>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Yeni Sablon Ekle</h2>
        <form action={createCannedReplyAction} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label>
            Baslik
            <input name="title" required placeholder="Ornegin: Tesekkur mesaji" />
          </label>
          <label>
            Yanit Metni
            <textarea name="body" required rows={4} placeholder="Vatandasa gonderilecek tam metin..." />
          </label>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label>
              Dil
              <select name="lang" defaultValue="tr">
                <option value="tr">Turkce</option>
                <option value="en">Ingilizce</option>
                <option value="ku">Kurtce</option>
                <option value="ar">Arapca</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.2rem' }}>
              <input type="checkbox" name="isShared" />
              Tum ekiple paylas
            </label>
          </div>
          <button type="submit" style={{ alignSelf: 'flex-start' }}>Sablon Kaydet</button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Mevcut Sablonlar</h2>
        {replies.length === 0 ? (
          <p className="muted">Henuz sablon eklenmemis.</p>
        ) : (
          <div className="responsive-list">
            {replies.map((r) => (
              <div className="queue-row" key={r.id} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <strong>{r.title}</strong>
                  <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                    {r.lang.toUpperCase()} · {r.isShared ? 'Paylasilan' : 'Kisisel'}
                  </span>
                </div>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                  {r.body.slice(0, 200)}{r.body.length > 200 ? '...' : ''}
                </p>
                <form action={deleteCannedReplyAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" style={{ fontSize: '0.75rem', background: 'none', color: 'var(--danger)', border: 'none', cursor: 'pointer' }}>
                    Sil
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
