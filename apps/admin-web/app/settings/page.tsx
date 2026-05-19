import { adminApi, type AiBudgetSettings, type RetentionSettings, type UserSummary, type WidgetEmbedConfig, type WidgetSettings } from '../../lib/api';
import { canManageSettings, resolveAdminSession } from '../../lib/session';
import { AdminShell } from '../components/admin-shell';
import { PendingFieldset, PendingSubmitButton } from '../components/form-controls';
import { WidgetStatusProbe } from './widget-status-probe';
import {
  createCategoryAction,
  createDepartmentAction,
  createSlaPolicyAction,
  runRetentionNowAction,
  updateAiBudgetSettingsAction,
  updateCategoryAction,
  updateDepartmentAction,
  updateRetentionSettingsAction,
  updateSlaPolicyAction,
  updateTemplateAction,
  updateUserAction,
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
  'retention-updated': { title: 'Saklama suresi ayarlari kaydedildi.', detail: 'Yeni degerler bir sonraki retention worker dongusunde uygulanir; bos birakilan kapsamlar varsayilana doner.' },
  'retention-run-triggered': { title: 'Retention isi kuyruga eklendi.', detail: 'Worker dry-run/canli bayraklarina gore aktif kapsamlari isler. Bu islem dosya/dB silmeyi tetiklemez ki RETENTION_DRY_RUN=false olmadikca.' },
  'ai-budget-updated': { title: 'AI butce ayarlari kaydedildi.', detail: 'Tenant butce sinirlari sonraki vatandas intake cagrisinda gecerli olur; bos birakilan alanlar global env varsayilanina doner.' },
  'user-updated': { title: 'Kullanici guncellendi.', detail: 'Ad, rol ve aktiflik degisiklikleri kaydedildi; sonraki giriste gecerli olur.' },
};

const retentionScopeCopy: Record<string, { title: string; detail: string }> = {
  'channel-events': { title: 'Kanal olaylari', detail: 'WhatsApp/Instagram/SMS gibi kanallarin ham webhook olaylari.' },
  'audit-logs': { title: 'Denetim kayitlari', detail: 'Yonetici aksiyonlari, durum gecisleri ve KVKK gerektirdigi izleme kayitlari.' },
  'outbound-deliveries': { title: 'Disa giden teslimatlar', detail: 'Vatandasa gonderilen mesajlarin teslim/basarisiz/atlandi durumdaki kayitlari.' },
  'conversations': { title: 'Konusmalar', detail: 'Ticket olusturulmus veya kapanmis konusmalar; aktif konusmalar yine korunur.' },
  'attachments': { title: 'Ekler', detail: 'Vatandasin yukledigi dosyalarin kaydi ve depolama anahtarlari.' },
};

function buildWidgetEmbedConfig(settings: WidgetSettings): WidgetEmbedConfig {
  const citizenBaseUrl = resolveCitizenBaseUrl();
  const scriptPath = `${citizenBaseUrl}/widget.js`;
  const previewPath = `${citizenBaseUrl}/widget/${settings.tenantSlug}`;
  const escapedTenant = escapeHtmlAttribute(settings.tenantSlug);
  const escapedTitle = escapeHtmlAttribute(settings.widgetTitle);
  return {
    ...settings,
    scriptPath,
    previewPath,
    scriptSnippet: `<script src="${scriptPath}" data-tenant="${escapedTenant}" data-label="${escapedTitle}" async></script>`,
  };
}

function resolveCitizenBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_CITIZEN_WEB_BASE_URL ??
    process.env.PUBLIC_CITIZEN_BASE_URL ??
    process.env.CITIZEN_WEB_BASE_URL ??
    '';
  return configured.trim().replace(/\/+$/, '') || '';
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
  'update-retention': { title: 'Saklama ayarlari kaydedilemedi.', detail: 'Her kapsam icin 1 ile 3650 gun arasi tam sayi girin ya da bos birakarak varsayilana donmesini saglayin.' },
  'update-ai-budget': { title: 'AI butce ayarlari kaydedilemedi.', detail: 'Her alan pozitif tam sayi olmali ya da bos kalmali; bos alan global env varsayilani kullanmaya doner.' },
  'update-user': { title: 'Kullanici guncellenemedi.', detail: 'Rol, ad ve aktiflik alanlarini kontrol edip tekrar deneyin.' },
  forbidden: { title: 'Ayar degisikligi bu rol icin kapali.', detail: 'Frontend ayar mutasyonlarini yonetici rolleriyle sinirlandiriyor; son yetki kontrolu yine backend tarafinda.' },
  general: { title: 'Ayar kaydedilemedi.', detail: 'Baglanti, yetki veya kayit durumunu kontrol edip islemi tekrar deneyin.' },
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string; errorMessage?: string }> }) {
  const session = await resolveAdminSession();
  const hasSession = Boolean(session);
  const token = session?.accessToken ?? null;
  const role = session?.user.role ?? null;
  const canEditSettings = canManageSettings(role);
  const controlsDisabled = !hasSession || !canEditSettings;
  const { success, error, errorMessage } = await searchParams;
  const fallbackWidgetSettings: WidgetSettings = {
    tenantSlug: session?.user.tenantSlug ?? 'demo-belediye',
    widgetEnabled: true,
    widgetTitle: 'Belediye asistanı',
    widgetWelcome: 'Merhaba, belediyeye iletmek istediğiniz konuyu yazın.',
    widgetAllowedOrigins: [],
  };
  const fallbackRetentionSettings: RetentionSettings = {
    tenantSlug: session?.user.tenantSlug ?? 'demo-belediye',
    defaults: {
      'channel-events': 60,
      'audit-logs': 365,
      'outbound-deliveries': 90,
      'conversations': 180,
      'attachments': 365,
    },
    overrides: {},
  };
  const fallbackAiBudgetSettings: AiBudgetSettings = {
    tenantSlug: session?.user.tenantSlug ?? 'demo-belediye',
    overrides: {},
  };
  const emptyUsers: UserSummary[] = [];
  const [departments, categories, slaPolicies, templates, widgetSettings, retentionSettings, aiBudgetSettings, staffUsers] = token
    ? await Promise.all([
        adminApi.departments(token).catch(() => []),
        adminApi.categories(token).catch(() => []),
        adminApi.slaPolicies(token).catch(() => []),
        adminApi.messageTemplates(token).catch(() => []),
        adminApi.widgetSettings(token).catch(() => fallbackWidgetSettings),
        adminApi.retentionSettings(token).catch(() => fallbackRetentionSettings),
        adminApi.aiBudgetSettings(token).catch(() => fallbackAiBudgetSettings),
        adminApi.users(token).catch(() => emptyUsers),
      ])
    : [[], [], [], [], fallbackWidgetSettings, fallbackRetentionSettings, fallbackAiBudgetSettings, emptyUsers];
  const widgetEmbed = buildWidgetEmbedConfig(widgetSettings);
  const retentionScopes = Object.keys(retentionSettings.defaults) as Array<keyof typeof retentionSettings.defaults>;

  return (
    <AdminShell hasSession={hasSession} role={role}>
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
              <li>Script: <code>{widgetEmbed.scriptPath || '/widget.js'}</code></li>
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
      <section className="card">
        <p className="badge">KVKK / Saklama suresi</p>
        <h2>Tenant bazli retention ayarlari</h2>
        <p style={{ color: 'var(--muted)', maxWidth: 820 }}>
          Bos birakilan kapsamlar varsayilan degeri kullanir. Degerler gun olarak girilir; aralik 1 - 3650.
          Yeni degerler bir sonraki retention worker dongusunde uygulanir. Ayar degistigi an worker hemen calismaz; canli silme hala <code>RETENTION_DRY_RUN=false</code> ile <code>RETENTION_DELETE_ATTACHMENT_OBJECTS=true</code> bayraklarina baglidir.
        </p>
        <form action={updateRetentionSettingsAction} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <PendingFieldset style={{ display: 'grid', gap: 12 }}>
            <input type="hidden" name="intent" value="update-retention" />
            {retentionScopes.map((scope) => {
              const copy = retentionScopeCopy[scope] ?? { title: scope, detail: '' };
              const override = retentionSettings.overrides[scope];
              const fallback = retentionSettings.defaults[scope];
              return (
                <label key={scope} style={{ display: 'grid', gap: 4 }}>
                  <span><strong>{copy.title}</strong> <span style={{ color: 'var(--muted)' }}>(varsayilan {fallback} gun)</span></span>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>{copy.detail}</span>
                  <input
                    name={scope}
                    type="number"
                    min={1}
                    max={3650}
                    step={1}
                    inputMode="numeric"
                    placeholder={String(fallback)}
                    defaultValue={typeof override === 'number' ? override : ''}
                    disabled={controlsDisabled}
                  />
                </label>
              );
            })}
            <PendingSubmitButton type="submit" disabled={controlsDisabled} idleLabel="Saklama suresi ayarlarini kaydet" pendingLabel="Kaydediliyor..." />
          </PendingFieldset>
        </form>
        <div className="notice muted" role="note">
          <strong>KVKK notu</strong>
          <p>Tenant bazli kisaltmalar daha kati saklama sureleri saglayabilir. Belirlenen pencere sonunda silme hala worker tarafindaki dry-run/canli bayraklarina baglidir; bu ekran yalniz kapsam basina pencereyi belirler.</p>
        </div>
        <form action={runRetentionNowAction} style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          <PendingFieldset style={{ display: 'grid', gap: 8 }}>
            <input type="hidden" name="intent" value="retention-run-now" />
            <p style={{ color: 'var(--muted)', margin: 0 }}>
              Daily 03:00 (UTC) cron is registered automatically; bu butonla kuyruga manuel bir is ekleyebilirsiniz. Worker dry-run modunda yalnizca sayar.
            </p>
            <PendingSubmitButton type="submit" disabled={controlsDisabled} idleLabel="Retention isi simdi calistir" pendingLabel="Kuyruga eklendi..." />
          </PendingFieldset>
        </form>
      </section>
      <section className="card">
        <p className="badge">AI butce kontrolu</p>
        <h2>Tenant bazli AI bütçe sınırları</h2>
        <p style={{ color: 'var(--muted)', maxWidth: 820 }}>
          Bos birakilan alanlar global env varsayilanini kullanir (<code>AI_DAILY_TOKEN_BUDGET</code>, <code>AI_DAILY_COST_BUDGET_MICROS</code>, <code>AI_PER_REQUEST_TOKEN_LIMIT</code>). Buradaki tenant degerleri yalniz mevcut belediye icin uygulanir; sinir asilirsa intake otomatik olarak deterministik stub'a duser.
        </p>
        <form action={updateAiBudgetSettingsAction} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <PendingFieldset style={{ display: 'grid', gap: 12 }}>
            <input type="hidden" name="intent" value="update-ai-budget" />
            <label style={{ display: 'grid', gap: 4 }}>
              <span><strong>Gunluk token butcesi</strong> <span style={{ color: 'var(--muted)' }}>(opsiyonel)</span></span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>Son 24 saatte tenantin toplam tokeni bu sayiyi asarsa stub fallback'a duser.</span>
              <input
                name="dailyTokenBudget"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="ornek: 50000"
                defaultValue={typeof aiBudgetSettings.overrides.dailyTokenBudget === 'number' ? aiBudgetSettings.overrides.dailyTokenBudget : ''}
                disabled={controlsDisabled}
              />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span><strong>Gunluk maliyet limiti (mikro-USD)</strong> <span style={{ color: 'var(--muted)' }}>(opsiyonel)</span></span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>1.000.000 mikro = 1 USD. Ornek: 50000000 yaklasik 50 USD/gun limit anlamina gelir.</span>
              <input
                name="dailyCostBudgetMicros"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="ornek: 50000000"
                defaultValue={typeof aiBudgetSettings.overrides.dailyCostBudgetMicros === 'number' ? aiBudgetSettings.overrides.dailyCostBudgetMicros : ''}
                disabled={controlsDisabled}
              />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span><strong>Cagri basina max token</strong> <span style={{ color: 'var(--muted)' }}>(opsiyonel)</span></span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>Bu degeri asan cagriyi provider yine de cevaplayabilir; sinir telemetri amaclidir, hard cap olarak Anthropic max_tokens'i frenler.</span>
              <input
                name="perRequestTokenLimit"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="ornek: 1200"
                defaultValue={typeof aiBudgetSettings.overrides.perRequestTokenLimit === 'number' ? aiBudgetSettings.overrides.perRequestTokenLimit : ''}
                disabled={controlsDisabled}
              />
            </label>
            <PendingSubmitButton type="submit" disabled={controlsDisabled} idleLabel="AI butce ayarlarini kaydet" pendingLabel="Kaydediliyor..." />
          </PendingFieldset>
        </form>
        <div className="notice muted" role="note">
          <strong>Maliyet uyarisi</strong>
          <p>Sinir asildiginda intake hala calisir, ancak deterministik stub uretir; vatandas algilamaz. Audit log'da `errorReason: budget:*` olarak gorunur.</p>
        </div>
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
          <h2>Personel yonetimi</h2>
          <p style={{ color: 'var(--muted)' }}>Tum aktif ve pasif kullanici hesaplari. Sifre sifirlamak veya rol degistirmek icin ilgili kullanicinin kaydini duzenleyin.</p>
          {(staffUsers as UserSummary[]).length ? (
            <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
              {(staffUsers as UserSummary[]).map((u) => (
                <form key={u.id} action={updateUserAction} style={{ display: 'grid', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <PendingFieldset style={{ display: 'grid', gap: 8 }}>
                    <input type="hidden" name="intent" value="update-user" />
                    <input type="hidden" name="id" value={u.id} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                      <strong>{u.email}</strong>
                      <span style={{ color: u.isActive ? 'var(--accent)' : 'var(--muted)', fontSize: '0.85em' }}>{u.isActive ? 'Aktif' : 'Pasif'}</span>
                    </div>
                    <input name="fullName" defaultValue={u.fullName} placeholder="Ad soyad" disabled={controlsDisabled} />
                    <select name="role" defaultValue={u.role} disabled={controlsDisabled}>
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      <option value="TENANT_ADMIN">TENANT_ADMIN</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="DEPARTMENT_STAFF">DEPARTMENT_STAFF</option>
                      <option value="OPERATOR">OPERATOR</option>
                      <option value="READ_ONLY">READ_ONLY</option>
                    </select>
                    <select name="isActive" defaultValue={String(u.isActive)} disabled={controlsDisabled}>
                      <option value="true">Aktif</option>
                      <option value="false">Pasif</option>
                    </select>
                    <PendingSubmitButton type="submit" disabled={controlsDisabled} idleLabel="Kullanici guncelle" pendingLabel="Kaydediliyor..." />
                  </PendingFieldset>
                </form>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--muted)', marginTop: 8 }}>Personel listesi alinamadi veya henuz kimse eklenmemis.</p>
          )}
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
    </AdminShell>
  );
}
