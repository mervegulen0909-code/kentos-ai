import { adminApi, type WidgetEmbedConfig, type WidgetSettings } from '../../lib/api';
import { canManageSettings, getAdminSession } from '../../lib/session';
import { PendingFieldset, PendingSubmitButton } from '../components/form-controls';
import { WidgetStatusProbe } from './widget-status-probe';
import {
  createCategoryAction,
  createDepartmentAction,
  createSlaPolicyAction,
  updateCategoryAction,
  updateDepartmentAction,
  updateSlaPolicyAction,
  updateTemplateAction,
  updateWidgetSettingsAction,
} from './actions';

type FeedbackCopy = { title: string; detail: string };

const successCopy: Record<string, FeedbackCopy> = {
  'department-created': { title: 'Departman eklendi.', detail: 'Yeni birim artik kategori ve talep atama akislarinda kullanilabilir.' },
  'department-updated': { title: 'Departman bilgileri kaydedildi.', detail: 'Birim adi, aciklamasi ve aktiflik durumu operasyon ekranlarina yansir.' },
  'category-created': { title: 'Kategori eklendi.', detail: 'Vatandas talepleri bu kategoriyle eslesebilir; varsayilan oncelik uygulanir.' },
  'category-updated': { title: 'Kategori ayarlari guncellendi.', detail: 'Birim eslesmesi, oncelik ve aktiflik bilgisi yeni taleplerde kullanilacak.' },
  'sla-created': { title: 'SLA politikasi eklendi.', detail: 'Yanit ve cozum sureleri uygun talepler icin izlenmeye basladi.' },
  'sla-updated': { title: 'SLA politikasi kaydedildi.', detail: 'Sure ve aktiflik degisiklikleri sonraki SLA degerlendirmelerinde kullanilacak.' },
  'template-updated': { title: 'Mesaj sablonu kaydedildi.', detail: 'Vatandasla paylasilan standart metin guncel haliyle kullanilacak.' },
  'widget-updated': { title: 'Widget ayarlari kaydedildi.', detail: 'Baslik, karsilama metni ve origin izin listesi yeni widget isteklerinde kullanilacak.' },
};

function buildWidgetEmbedConfig(settings: WidgetSettings): WidgetEmbedConfig {
  const scriptPath = '/widget.js';
  const previewPath = `/widget/${settings.tenantSlug}`;
  return {
    ...settings,
    scriptPath,
    previewPath,
    scriptSnippet: `<script src="${scriptPath}" data-tenant="${settings.tenantSlug}" data-label="${settings.widgetTitle}" async></script>`,
  };
}

const errorCopy: Record<string, FeedbackCopy> = {
  session: { title: 'Oturum bulunamadi.', detail: 'Ayar degisikligi icin yeniden giris yapin; guvenlik nedeniyle islem gonderilmedi.' },
  'create-department': { title: 'Departman eklenemedi.', detail: 'Kod benzersiz olmali; kod ve ad alanlarini bos birakmayin.' },
  'update-department': { title: 'Departman guncellenemedi.', detail: 'Birim adi ve aktiflik alanlarini kontrol edip tekrar deneyin.' },
  'create-category': { title: 'Kategori eklenemedi.', detail: 'Kod ve ad zorunludur; secili departman pasifse kategori olusturulamaz.' },
  'update-category': { title: 'Kategori guncellenemedi.', detail: 'Departman secimini, oncelik degerini ve aktiflik durumunu kontrol edin.' },
  'create-sla': { title: 'SLA politikasi eklenemedi.', detail: 'Yanit ve cozum sureleri 1 dakikadan buyuk olmali; ayni kapsamda cakisan politika olabilir.' },
  'update-sla': { title: 'SLA politikasi kaydedilemedi.', detail: 'Sure degerlerini ve aktiflik durumunu kontrol edip tekrar deneyin.' },
  'update-template': { title: 'Sablon kaydedilemedi.', detail: 'Vatandas mesaji bos olmamali; metni sade ve islem odakli tutun.' },
  'update-widget': { title: 'Widget ayarlari kaydedilemedi.', detail: 'Baslik, karsilama metni ve origin satirlarini kontrol edip tekrar deneyin.' },
  forbidden: { title: 'Ayar degisikligi bu rol icin kapali.', detail: 'Frontend ayar mutasyonlarini yonetici rolleriyle sinirlandiriyor; son yetki kontrolu yine backend tarafinda.' },
  general: { title: 'Ayar kaydedilemedi.', detail: 'Baglanti, yetki veya kayit durumunu kontrol edip islemi tekrar deneyin.' },
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string; errorMessage?: string }> }) {
  const session = await getAdminSession();
  const hasSession = Boolean(session);
  const token = session?.accessToken ?? null;
  const canEditSettings = canManageSettings(session?.user.role);
  const controlsDisabled = !hasSession || !canEditSettings;
  const { success, error, errorMessage } = await searchParams;
  const fallbackWidgetSettings: WidgetSettings = {
    tenantSlug: session?.user.tenantSlug ?? 'demo-belediye',
    widgetEnabled: true,
    widgetTitle: 'Belediye asistanı',
    widgetWelcome: 'Merhaba, belediyeye iletmek istediğiniz konuyu yazın.',
    widgetAllowedOrigins: [],
  };
  const [departments, categories, slaPolicies, templates, widgetSettings] = token
    ? await Promise.all([
        adminApi.departments(token).catch(() => []),
        adminApi.categories(token).catch(() => []),
        adminApi.slaPolicies(token).catch(() => []),
        adminApi.messageTemplates(token).catch(() => []),
        adminApi.widgetSettings(token).catch(() => fallbackWidgetSettings),
      ])
    : [[], [], [], [], fallbackWidgetSettings];
  const widgetEmbed = buildWidgetEmbedConfig(widgetSettings);

  return (
    <main className="main">
      <p className="badge">Tenant ayarlari</p>
      <h1>Belediye yapilandirmasi</h1>
      {success ? (
        <div className="notice success" role="status">
          <strong>{(successCopy[success] ?? { title: 'Ayar kaydedildi.', detail: 'Yapilandirma ekrani guncel verilerle yenilendi.' }).title}</strong>
          <p>{(successCopy[success] ?? { title: 'Ayar kaydedildi.', detail: 'Yapilandirma ekrani guncel verilerle yenilendi.' }).detail}</p>
        </div>
      ) : null}
      {error ? (
        <div className="notice error" role="alert">
          <strong>{(errorCopy[error] ?? errorCopy.general).title}</strong>
          <p>{errorMessage ?? (errorCopy[error] ?? errorCopy.general).detail}</p>
        </div>
      ) : null}
      {!hasSession ? <p className="notice muted">Ayarlari duzenlemek icin giris yapin. Formlar guvenli bicimde pasif tutulur.</p> : null}
      {token ? (
        <div className="notice muted" role="note">
          <strong>{canEditSettings ? 'Ayar degisiklikleri yonetici roluyla acik.' : 'Bu oturum yalnizca goruntuleme modunda.'}</strong>
          <p>{canEditSettings ? 'Token client componente tasinmadan guvenli server action akisi kullanilir.' : 'Backend tarafinda kesin izin matrisi olmadikca frontend yalnizca yonetici benzeri rollere ayar mutasyonu affordancei acar.'}</p>
        </div>
      ) : null}
      <section className="card widget-install-card">
        <p className="badge">Web asistani kurulumu</p>
        <h2>Belediye sitesine tek script ile ekle</h2>
        <p style={{ color: 'var(--muted)', maxWidth: 820 }}>
          Bu kodu belediye sitesinin kapanis <code>{'</body>'}</code> etiketinden hemen once ekleyin. Widget iframe icinde acilir, tenant slug degeriyle izole calisir ve vatandas mesajlarini <strong>WEB_CHAT</strong> kanalindan mevcut ticket omurgasina aktarir.
        </p>
        <div className="install-code-grid">
          <div>
            <strong>Kurulum kodu</strong>
            <pre className="install-code" aria-label="Widget kurulum kodu">{widgetEmbed.scriptSnippet}</pre>
          </div>
          <div className="install-checklist">
            <strong>Kurulum kontrolu</strong>
            <ul>
              <li>Tenant: <code>{widgetEmbed.tenantSlug}</code></li>
              <li>Script: <code>{widgetEmbed.scriptPath}</code></li>
              <li>Onizleme: <a href={widgetEmbed.previewPath}>{widgetEmbed.previewPath}</a></li>
              <li>Beklenen kanal: <code>WEB_CHAT</code></li>
              <li>Durum: <code>{widgetEmbed.widgetEnabled ? 'Aktif' : 'Pasif'}</code></li>
            </ul>
          </div>
        </div>
        <form action={updateWidgetSettingsAction} style={{ display: 'grid', gap: 12, marginTop: 18 }}>
          <PendingFieldset style={{ display: 'grid', gap: 12 }}>
            <input type="hidden" name="intent" value="update-widget" />
            <label style={{ display: 'grid', gap: 6 }}>
              Widget durumu
              <select name="widgetEnabled" defaultValue={String(widgetEmbed.widgetEnabled)} disabled={controlsDisabled}>
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              Widget basligi
              <input name="widgetTitle" defaultValue={widgetEmbed.widgetTitle} disabled={controlsDisabled} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              Karsilama metni
              <textarea name="widgetWelcome" rows={3} defaultValue={widgetEmbed.widgetWelcome} disabled={controlsDisabled} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              Origin izin listesi — her satira bir origin
              <textarea name="widgetAllowedOrigins" rows={3} defaultValue={widgetEmbed.widgetAllowedOrigins.join('\n')} placeholder="https://www.belediye.gov.tr" disabled={controlsDisabled} />
            </label>
            <PendingSubmitButton type="submit" disabled={controlsDisabled} idleLabel="Widget ayarlarini kaydet" pendingLabel="Kaydediliyor..." />
          </PendingFieldset>
        </form>
        <div className="notice muted" role="note">
          <strong>Guvenlik notu</strong>
          <p>Origin izin listesi tenant ayari olarak saklanir; env allowlist sadece operasyonel ek izin katmani olarak kalir.</p>
        </div>
        <WidgetStatusProbe tenantSlug={widgetEmbed.tenantSlug} />
      </section>
      <div className="grid">
        <section className="card">
          <h2>Departmanlar</h2>
          <form action={createDepartmentAction} style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
            <PendingFieldset style={{ display: 'grid', gap: 10 }}>
              <input type="hidden" name="intent" value="create-department" />
              <input name="code" placeholder="KOD" required disabled={controlsDisabled} />
              <input name="name" placeholder="Departman adi" required disabled={controlsDisabled} />
              <input name="description" placeholder="Aciklama" disabled={controlsDisabled} />
              <PendingSubmitButton type="submit" disabled={controlsDisabled} idleLabel="Departman ekle" pendingLabel="Ekleniyor..." />
            </PendingFieldset>
          </form>
          {departments.map((department) => (
            <form key={department.id} action={updateDepartmentAction} style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              <PendingFieldset style={{ display: 'grid', gap: 8 }}>
                <input type="hidden" name="intent" value="update-department" />
                <input type="hidden" name="id" value={department.id} />
                <input name="name" defaultValue={department.name} disabled={controlsDisabled} />
                <input name="description" defaultValue={department.description ?? ''} placeholder="Aciklama" disabled={controlsDisabled} />
                <select name="isActive" defaultValue={String(department.isActive)} disabled={controlsDisabled}>
                  <option value="true">Aktif</option>
                  <option value="false">Pasif</option>
                </select>
                <PendingSubmitButton type="submit" disabled={controlsDisabled} idleLabel={`${department.code} guncelle`} pendingLabel="Kaydediliyor..." />
              </PendingFieldset>
            </form>
          ))}
        </section>
        <section className="card">
          <h2>Kategoriler</h2>
          <form action={createCategoryAction} style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
            <PendingFieldset style={{ display: 'grid', gap: 10 }}>
              <input type="hidden" name="intent" value="create-category" />
              <input name="code" placeholder="KATEGORI_KODU" required disabled={controlsDisabled} />
              <input name="name" placeholder="Kategori adi" required disabled={controlsDisabled} />
              <select name="departmentId" defaultValue="" disabled={controlsDisabled}>
                <option value="">Departman secilmedi</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
              <select name="defaultPriority" defaultValue="NORMAL" disabled={controlsDisabled}>
                {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((priority) => <option key={priority}>{priority}</option>)}
              </select>
              <PendingSubmitButton type="submit" disabled={controlsDisabled} idleLabel="Kategori ekle" pendingLabel="Ekleniyor..." />
            </PendingFieldset>
          </form>
          {categories.map((category) => (
            <form key={category.id} action={updateCategoryAction} style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              <PendingFieldset style={{ display: 'grid', gap: 8 }}>
                <input type="hidden" name="intent" value="update-category" />
                <input type="hidden" name="id" value={category.id} />
                <input name="name" defaultValue={category.name} disabled={controlsDisabled} />
                <select name="departmentId" defaultValue={category.departmentId ?? ''} disabled={controlsDisabled}>
                  <option value="">Departman secilmedi</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
                <select name="defaultPriority" defaultValue={category.defaultPriority} disabled={controlsDisabled}>
                  {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((priority) => <option key={priority}>{priority}</option>)}
                </select>
                <select name="isActive" defaultValue={String(category.isActive)} disabled={controlsDisabled}>
                  <option value="true">Aktif</option>
                  <option value="false">Pasif</option>
                </select>
                <PendingSubmitButton type="submit" disabled={controlsDisabled} idleLabel={`${category.code} guncelle`} pendingLabel="Kaydediliyor..." />
              </PendingFieldset>
            </form>
          ))}
        </section>
        <section className="card">
          <h2>SLA politikalari</h2>
          <form action={createSlaPolicyAction} style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
            <PendingFieldset style={{ display: 'grid', gap: 10 }}>
              <input type="hidden" name="intent" value="create-sla" />
              <select name="priority" defaultValue="NORMAL" disabled={controlsDisabled}>
                {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((priority) => <option key={priority}>{priority}</option>)}
              </select>
              <input name="responseMinutes" type="number" min={1} defaultValue={240} disabled={controlsDisabled} />
              <input name="resolutionMinutes" type="number" min={1} defaultValue={4320} disabled={controlsDisabled} />
              <select name="departmentId" defaultValue="" disabled={controlsDisabled}>
                <option value="">Genel politika</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
              <select name="categoryId" defaultValue="" disabled={controlsDisabled}>
                <option value="">Kategori secilmedi</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <PendingSubmitButton type="submit" disabled={controlsDisabled} idleLabel="SLA politikasi ekle" pendingLabel="Ekleniyor..." />
            </PendingFieldset>
          </form>
          {slaPolicies.length ? slaPolicies.map((policy) => (
            <form key={policy.id} action={updateSlaPolicyAction} style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              <PendingFieldset style={{ display: 'grid', gap: 8 }}>
                <input type="hidden" name="intent" value="update-sla" />
                <input type="hidden" name="id" value={policy.id} />
                <strong>{policy.priority} - {policy.department?.name ?? 'Genel'} - {policy.category?.name ?? 'Tum kategoriler'}</strong>
                <input name="responseMinutes" type="number" min={1} defaultValue={policy.responseMinutes} disabled={controlsDisabled} />
                <input name="resolutionMinutes" type="number" min={1} defaultValue={policy.resolutionMinutes} disabled={controlsDisabled} />
                <select name="isActive" defaultValue={String(policy.isActive)} disabled={controlsDisabled}>
                  <option value="true">Aktif</option>
                  <option value="false">Pasif</option>
                </select>
                <PendingSubmitButton type="submit" disabled={controlsDisabled} idleLabel="SLA guncelle" pendingLabel="Kaydediliyor..." />
              </PendingFieldset>
            </form>
          )) : <p style={{ color: 'var(--muted)' }}>SLA politikasi yok.</p>}
        </section>
        <section className="card">
          <h2>Mesaj sablonlari</h2>
          <p style={{ color: 'var(--muted)' }}>
            Kullanilabilen degiskenler: <code>{'{{trackingToken}}'}</code>, <code>{'{{ticketNo}}'}</code>, <code>{'{{departmentName}}'}</code>, <code>{'{{question}}'}</code>.
          </p>
          {templates.map((template) => (
            <form key={template.id} action={updateTemplateAction} style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
              <PendingFieldset style={{ display: 'grid', gap: 8 }}>
                <input type="hidden" name="intent" value="update-template" />
                <input type="hidden" name="id" value={template.id} />
                <strong>{template.key}</strong>
                <textarea name="body" defaultValue={template.body} rows={3} disabled={controlsDisabled} />
                <select name="channel" defaultValue={template.channel ?? ''} disabled={controlsDisabled}>
                  <option value="">Tum kanallar</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="WEB_CHAT">Web sohbet</option>
                  <option value="CITIZEN_WEB">Vatandas portali</option>
                  <option value="MOBILE_APP">Mobil uygulama</option>
                  <option value="INSTAGRAM">Instagram DM</option>
                  <option value="FACEBOOK">Facebook DM</option>
                  <option value="SMS">SMS</option>
                </select>
                <select name="isActive" defaultValue={String(template.isActive)} disabled={controlsDisabled}>
                  <option value="true">Aktif</option>
                  <option value="false">Pasif</option>
                </select>
                <PendingSubmitButton type="submit" disabled={controlsDisabled} idleLabel="Sablonu guncelle" pendingLabel="Kaydediliyor..." />
              </PendingFieldset>
            </form>
          ))}
        </section>
      </div>
    </main>
  );
}
