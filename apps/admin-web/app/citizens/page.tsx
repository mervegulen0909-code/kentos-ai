import { adminApi, type CitizenListItem } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';
import { AdminShell } from '../components/admin-shell';

const fallback: CitizenListItem[] = [];

export default async function CitizensPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const session = await resolveAdminSession();
  const token = session?.accessToken ?? null;
  const role = session?.user.role ?? null;

  const canAnonymize = role === 'SUPER_ADMIN' || role === 'TENANT_ADMIN';

  let result = { data: fallback, meta: { total: 0, page: 1, limit: 50 } };
  let dataUnavailable = false;

  if (token) {
    result = await adminApi.citizens(token, { q: params.q, page: params.page ? Number(params.page) : 1 }).catch(() => {
      dataUnavailable = true;
      return result;
    });
  }

  return (
    <AdminShell hasSession={Boolean(token)} role={role}>
      <p className="badge">GDPR · Vatandaş Yönetimi</p>
      <h1>Vatandaş Kayıtları</h1>
      <p className="muted">Kişisel verilerin anonimleştirilmesi ve dışa aktarımı. Yalnızca yetkili personel erişebilir.</p>

      {dataUnavailable && <p className="notice error" role="alert">Vatandaş listesi alınamadı.</p>}

      {/* Search */}
      <section className="card filter-card">
        <form className="filter-grid">
          <label>
            Telefon / E-posta Arama
            <input name="q" defaultValue={params.q ?? ''} placeholder="+905551234567 veya ornek@mail.com" />
          </label>
          <div className="filter-actions">
            <button type="submit">Ara</button>
            <a className="button-like secondary-button" href="/citizens">Temizle</a>
          </div>
        </form>
        <p className="filter-summary">{result.meta.total} kayıt · sayfa {result.meta.page}</p>
      </section>

      {/* List */}
      <section className="card">
        <div className="ticket-list">
          {result.data.length > 0 ? result.data.map((citizen) => (
            <div key={citizen.id} className="ticket-list-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{citizen.displayName ?? '—'}</strong>
                <span style={{ marginLeft: '0.75rem', color: 'var(--muted)' }}>
                  {citizen.phone ?? citizen.email ?? 'İletişim yok'}
                </span>
                <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
                  {citizen.ticketCount} talep
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <a className="button-like secondary-button" href={`/citizens/${citizen.id}`} style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}>
                  Detay
                </a>
                {canAnonymize && !citizen.isAnonymized && (
                  <form method="POST" action={`/citizens/${citizen.id}/anonymize`} style={{ display: 'inline' }}>
                    <button
                      type="submit"
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem', background: 'var(--error, #dc2626)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      onClick={(e) => { if (!confirm('Bu vatandaşın kişisel verileri silinecek. Onaylıyor musunuz?')) e.preventDefault(); }}
                    >
                      Anonimleştir
                    </button>
                  </form>
                )}
              </div>
            </div>
          )) : (
            <div className="empty-state">
              <strong>Vatandaş kaydı bulunamadı.</strong>
              <p>Telefon veya e-posta ile arama yapın.</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {result.meta.total > 50 && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            {result.meta.page > 1 && (
              <a className="button-like secondary-button" href={`/citizens?page=${result.meta.page - 1}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`}>← Önceki</a>
            )}
            <a className="button-like secondary-button" href={`/citizens?page=${result.meta.page + 1}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`}>Sonraki →</a>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
