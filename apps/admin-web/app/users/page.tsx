import { adminApi, type UserListItem } from '../../lib/api';
import { resolveAdminSession } from '../../lib/session';
import { AdminShell } from '../components/admin-shell';
import { createUserAction } from './actions';

const roleCopy: Record<string, string> = {
  SUPER_ADMIN: 'Süper Admin',
  TENANT_ADMIN: 'Kiracı Admin',
  MANAGER: 'Yönetici',
  DEPARTMENT_STAFF: 'Birim Personeli',
  OPERATOR: 'Operatör',
  READ_ONLY: 'Salt Okuma',
};

const userRoles = ['TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR', 'READ_ONLY'];
const fallback: UserListItem[] = [];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>;
}) {
  const params = await searchParams;
  const session = await resolveAdminSession();
  const token = session?.accessToken ?? null;
  const role = session?.user.role ?? null;

  const canManage = role === 'SUPER_ADMIN' || role === 'TENANT_ADMIN';

  let result = { data: fallback, meta: { total: 0, page: 1, limit: 50 } };
  let dataUnavailable = false;

  if (token) {
    result = await adminApi.users(token, { q: params.q, role: params.role, page: params.page ? Number(params.page) : 1 }).catch(() => {
      dataUnavailable = true;
      return result;
    });
  }

  return (
    <AdminShell hasSession={Boolean(token)} role={role}>
      <p className="badge">Kullanıcılar · personel yönetimi</p>
      <h1>Kullanıcı Yönetimi</h1>

      {dataUnavailable && <p className="notice error" role="alert">Kullanıcı listesi alınamadı.</p>}

      {/* Filter bar */}
      <section className="card filter-card">
        <form className="filter-grid">
          <label>
            Arama
            <input name="q" defaultValue={params.q ?? ''} placeholder="İsim veya e-posta" />
          </label>
          <label>
            Rol
            <select name="role" defaultValue={params.role ?? ''}>
              <option value="">Tüm roller</option>
              {userRoles.map((r) => <option key={r} value={r}>{roleCopy[r] ?? r}</option>)}
            </select>
          </label>
          <div className="filter-actions">
            <button type="submit">Filtrele</button>
            <a className="button-like secondary-button" href="/users">Temizle</a>
          </div>
        </form>
        <p className="filter-summary">{result.meta.total} kullanıcı · sayfa {result.meta.page}</p>
      </section>

      {/* User list */}
      <section className="card">
        <div className="ticket-list">
          {result.data.length > 0 ? result.data.map((user) => (
            <div key={user.id} className="ticket-list-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{user.fullName}</strong>
                <span style={{ marginLeft: '0.75rem', color: 'var(--muted)' }}>{user.email}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className="badge">{roleCopy[user.role] ?? user.role}</span>
                {user.departments?.length > 0 && (
                  <span className="badge secondary">{user.departments.map((d) => d.name).join(', ')}</span>
                )}
                <span className={`badge ${user.isActive ? '' : 'error'}`}>{user.isActive ? 'Aktif' : 'Pasif'}</span>
              </div>
            </div>
          )) : (
            <div className="empty-state">
              <strong>Kullanıcı bulunamadı.</strong>
            </div>
          )}
        </div>
        {/* Pagination */}
        {result.meta.total > result.meta.limit && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            {result.meta.page > 1 && (
              <a className="button-like secondary-button" href={`/users?page=${result.meta.page - 1}${params.q ? `&q=${params.q}` : ''}${params.role ? `&role=${params.role}` : ''}`}>← Önceki</a>
            )}
            <a className="button-like secondary-button" href={`/users?page=${result.meta.page + 1}${params.q ? `&q=${params.q}` : ''}${params.role ? `&role=${params.role}` : ''}`}>Sonraki →</a>
          </div>
        )}
      </section>

      {/* Create user form — only for admins */}
      {canManage && (
        <section className="card">
          <h2>Yeni Kullanıcı Ekle</h2>
          <form action={async (fd) => { await createUserAction(fd); }} className="filter-grid">
            <label>
              E-posta
              <input name="email" type="email" required placeholder="kullanici@belediye.gov.tr" />
            </label>
            <label>
              Ad Soyad
              <input name="fullName" required placeholder="Ahmet Yılmaz" />
            </label>
            <label>
              Rol
              <select name="role" defaultValue="OPERATOR">
                {userRoles.map((r) => <option key={r} value={r}>{roleCopy[r] ?? r}</option>)}
              </select>
            </label>
            <label>
              Şifre
              <input name="password" type="password" required minLength={8} placeholder="En az 8 karakter" />
            </label>
            <div className="filter-actions">
              <button type="submit">Kullanıcı Oluştur</button>
            </div>
          </form>
        </section>
      )}
    </AdminShell>
  );
}
