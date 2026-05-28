import { adminApi } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';
import { AdminShell } from '../components/admin-shell';
import { createTagAction, deleteTagAction } from './actions';

export default async function TicketTagsPage() {
  const session = await resolveAdminSession();
  const token = session?.accessToken ?? null;
  const role = session?.user.role ?? null;

  const tags = token ? await adminApi.ticketTags(token).catch(() => []) : [];

  return (
    <AdminShell hasSession={Boolean(token)} role={role}>
      <p className="badge">Etiketler · talep siniflandirma</p>
      <h1>Ticket Etiketleri</h1>
      <p style={{ color: 'var(--muted)' }}>
        Talepler etiketle gruplanabilir. Renk kodlari ticket listesinde hizli tarama saglar.
      </p>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Yeni Etiket</h2>
        <form action={createTagAction} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
          <label>
            Etiket Adi
            <input name="name" required placeholder="ornegin: acil" style={{ width: 180 }} />
          </label>
          <label>
            Renk
            <input type="color" name="color" defaultValue="#6366f1" style={{ height: 36, width: 60, padding: 2 }} />
          </label>
          <button type="submit">Ekle</button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Etiketler</h2>
        {tags.length === 0 ? (
          <p className="muted">Henuz etiket eklenmemis.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: 8 }}>
            {tags.map((tag) => (
              <form key={tag.id} action={deleteTagAction} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <input type="hidden" name="id" value={tag.id} />
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  background: tag.color + '22', border: `1px solid ${tag.color}`,
                  borderRadius: 999, padding: '0.2rem 0.75rem', fontSize: '0.85rem',
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: tag.color, display: 'inline-block' }} />
                  {tag.name}
                  <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '0.75rem', padding: 0 }}>×</button>
                </span>
              </form>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
