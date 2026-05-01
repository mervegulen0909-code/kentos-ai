import { adminApi } from '../../lib/api';
import { getSessionToken } from '../../lib/session';
import {
  createCategoryAction,
  createDepartmentAction,
  createSlaPolicyAction,
  updateCategoryAction,
  updateDepartmentAction,
  updateSlaPolicyAction,
  updateTemplateAction,
} from './actions';

export default async function SettingsPage() {
  const token = await getSessionToken();
  const [departments, categories, slaPolicies, templates] = token
    ? await Promise.all([
        adminApi.departments(token).catch(() => []),
        adminApi.categories(token).catch(() => []),
        adminApi.slaPolicies(token).catch(() => []),
        adminApi.messageTemplates(token).catch(() => []),
      ])
    : [[], [], [], []];

  return (
    <main className="main">
      <p className="badge">Tenant ayarları</p>
      <h1>Belediye yapılandırması</h1>
      {!token ? <p style={{ color: 'var(--muted)' }}>Ayarları düzenlemek için giriş yapın.</p> : null}
      <div className="grid">
        <section className="card">
          <h2>Departmanlar</h2>
          <form action={createDepartmentAction} style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
            <input name="code" placeholder="KOD" required />
            <input name="name" placeholder="Departman adı" required />
            <input name="description" placeholder="Açıklama" />
            <button type="submit" disabled={!token}>Departman ekle</button>
          </form>
          {departments.map((department) => (
            <form key={department.id} action={updateDepartmentAction} style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              <input type="hidden" name="id" value={department.id} />
              <input name="name" defaultValue={department.name} />
              <input name="description" defaultValue={department.description ?? ''} placeholder="Açıklama" />
              <select name="isActive" defaultValue="true">
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </select>
              <button type="submit" disabled={!token}>{department.code} güncelle</button>
            </form>
          ))}
        </section>

        <section className="card">
          <h2>Kategoriler</h2>
          <form action={createCategoryAction} style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
            <input name="code" placeholder="KATEGORI_KODU" required />
            <input name="name" placeholder="Kategori adı" required />
            <select name="departmentId" defaultValue="">
              <option value="">Departman seçilmedi</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
            <select name="defaultPriority" defaultValue="NORMAL">
              {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((priority) => <option key={priority}>{priority}</option>)}
            </select>
            <button type="submit" disabled={!token}>Kategori ekle</button>
          </form>
          {categories.map((category) => (
            <form key={category.id} action={updateCategoryAction} style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              <input type="hidden" name="id" value={category.id} />
              <input name="name" defaultValue={category.name} />
              <select name="departmentId" defaultValue={category.departmentId ?? ''}>
                <option value="">Departman seçilmedi</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
              <select name="defaultPriority" defaultValue={category.defaultPriority}>
                {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((priority) => <option key={priority}>{priority}</option>)}
              </select>
              <select name="isActive" defaultValue="true">
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </select>
              <button type="submit" disabled={!token}>{category.code} güncelle</button>
            </form>
          ))}
        </section>

        <section className="card">
          <h2>SLA politikaları</h2>
          <form action={createSlaPolicyAction} style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
            <select name="priority" defaultValue="NORMAL">
              {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((priority) => <option key={priority}>{priority}</option>)}
            </select>
            <input name="responseMinutes" type="number" min={1} defaultValue={240} />
            <input name="resolutionMinutes" type="number" min={1} defaultValue={4320} />
            <select name="departmentId" defaultValue="">
              <option value="">Genel politika</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
            <select name="categoryId" defaultValue="">
              <option value="">Kategori seçilmedi</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <button type="submit" disabled={!token}>SLA politikası ekle</button>
          </form>
          {slaPolicies.length ? slaPolicies.map((policy) => (
            <form key={policy.id} action={updateSlaPolicyAction} style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              <input type="hidden" name="id" value={policy.id} />
              <strong>{policy.priority} · {policy.department?.name ?? 'Genel'} · {policy.category?.name ?? 'Tüm kategoriler'}</strong>
              <input name="responseMinutes" type="number" min={1} defaultValue={policy.responseMinutes} />
              <input name="resolutionMinutes" type="number" min={1} defaultValue={policy.resolutionMinutes} />
              <select name="isActive" defaultValue="true">
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </select>
              <button type="submit" disabled={!token}>SLA güncelle</button>
            </form>
          )) : <p style={{ color: 'var(--muted)' }}>SLA politikası yok.</p>}
        </section>

        <section className="card">
          <h2>Mesaj şablonları</h2>
          {templates.map((template) => (
            <form key={template.id} action={updateTemplateAction} style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
              <input type="hidden" name="id" value={template.id} />
              <strong>{template.key}</strong>
              <textarea name="body" defaultValue={template.body} rows={3} />
              <button type="submit" disabled={!token}>Şablonu güncelle</button>
            </form>
          ))}
        </section>
      </div>
    </main>
  );
}
