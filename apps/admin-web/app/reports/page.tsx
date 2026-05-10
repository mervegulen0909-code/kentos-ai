import {
  adminApi,
  type AnalyticsCategorySummary,
  type AnalyticsChannelSummary,
  type AnalyticsConversationSegments,
  type AnalyticsDepartmentSummary,
} from '../../lib/api';
import { canViewAnalytics, resolveAdminSession } from '../../lib/session';
import { AdminShell } from '../components/admin-shell';

const fallbackOverview = {
  totalOpen: 0,
  openedToday: 0,
  resolvedToday: 0,
  slaBreached: 0,
  slaDueSoon: 0,
  byStatus: [] as Array<{ status: string; count: number }>,
};

const fallbackChannels: AnalyticsChannelSummary[] = [];
const fallbackDepartments: AnalyticsDepartmentSummary[] = [];
const fallbackCategories: AnalyticsCategorySummary[] = [];
const fallbackSegments: AnalyticsConversationSegments = {
  totalConversations: 0,
  aiCompleted: 0,
  operatorHandoff: 0,
  awaitingInfo: 0,
  automationRate: 0,
};

const channelLabels: Record<string, string> = {
  WEB_CHAT: 'Web sohbet',
  WHATSAPP: 'WhatsApp',
  CITIZEN_WEB: 'Vatandas portali',
  MOBILE_APP: 'Mobil uygulama',
  OPERATOR: 'Operator',
  INSTAGRAM: 'Instagram DM',
  FACEBOOK: 'Facebook DM',
  SMS: 'SMS',
};

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default async function ReportsPage() {
  const session = await resolveAdminSession();
  const hasSession = Boolean(session);
  const token = session?.accessToken ?? null;
  const role = session?.user.role ?? null;
  const analyticsVisible = canViewAnalytics(role);
  let dataUnavailable = false;

  const [overview, channelSummary, departmentSummary, categorySummary, segments] = token && analyticsVisible
    ? await Promise.all([
        adminApi.overview(token).catch(() => {
          dataUnavailable = true;
          return fallbackOverview;
        }),
        adminApi.channelSummary(token).catch(() => {
          dataUnavailable = true;
          return fallbackChannels;
        }),
        adminApi.departmentSummary(token).catch(() => {
          dataUnavailable = true;
          return fallbackDepartments;
        }),
        adminApi.categorySummary(token).catch(() => {
          dataUnavailable = true;
          return fallbackCategories;
        }),
        adminApi.conversationSegments(token).catch(() => {
          dataUnavailable = true;
          return fallbackSegments;
        }),
      ])
    : [fallbackOverview, fallbackChannels, fallbackDepartments, fallbackCategories, fallbackSegments];

  const noOperationalData = !overview.totalOpen && !overview.openedToday && !overview.resolvedToday && !overview.slaBreached && !overview.slaDueSoon;
  const statusRows = overview.byStatus
    .slice()
    .sort((left, right) => right.count - left.count);
  const channelRows = channelSummary
    .slice()
    .sort((left, right) => right.tickets + right.conversations - (left.tickets + left.conversations));
  const noChannelData = !channelRows.length;
  const departmentRows = departmentSummary
    .slice()
    .sort((left, right) => right.openTickets - left.openTickets)
    .slice(0, 8);
  const categoryRows = categorySummary
    .slice()
    .sort((left, right) => right.tickets - left.tickets)
    .slice(0, 8);

  return (
    <AdminShell hasSession={hasSession} role={role}>
        <p className="badge">Operasyon raporlari - SLA ve cozum gorunumu</p>
        <h1>Gunluk belediye operasyon raporu</h1>
        {!hasSession ? (
          <div className="notice muted" role="note">
            <strong>Canli rapor icin oturum gerekli.</strong>
            <p>Yetkili kullanici girisi yapilana kadar ham API hatasi veya ic veri gosterilmez.</p>
          </div>
        ) : null}
        {hasSession && !analyticsVisible ? (
          <div className="notice muted" role="note">
            <strong>Bu rolde raporlar kapali.</strong>
            <p>Analytics endpointleri yalnizca yonetici rollerine acik. Ticket kuyrugu ve detay ekranlari kullanilabilir kalir.</p>
          </div>
        ) : null}
        {dataUnavailable ? (
          <div className="notice error" role="alert">
            <strong>Rapor verisi alinamadi.</strong>
            <p>Canli API yaniti su an kullanilamiyor; teknik ayrinti gizlendi. Baglanti veya yetki durumunu kontrol edin.</p>
          </div>
        ) : null}
        {analyticsVisible ? (
          <>
            <section className="grid" aria-label="Rapor KPI kartlari">
              <article className="card">
                <p>Acik operasyon yuku</p>
                <p className="kpi">{overview.totalOpen}</p>
                <p style={{ color: 'var(--muted)' }}>Birimlerde aktif takip bekleyen toplam basvuru.</p>
              </article>
              <article className="card">
                <p>Bugun acilan</p>
                <p className="kpi">{overview.openedToday}</p>
                <p style={{ color: 'var(--muted)' }}>Gunun yeni vatandas talebi hacmi.</p>
              </article>
              <article className="card">
                <p>Bugun sonuclanan</p>
                <p className="kpi">{overview.resolvedToday}</p>
                <p style={{ color: 'var(--muted)' }}>Cozum bildirilen veya kapatmaya yaklasan isler.</p>
              </article>
              <article className="card">
                <p>SLA alarmi</p>
                <p className="kpi" style={{ color: overview.slaBreached ? 'var(--danger)' : 'var(--accent)' }}>{overview.slaBreached}</p>
                <p style={{ color: 'var(--muted)' }}>Suresi asilmis ve yonetici takibi isteyen kayitlar.</p>
              </article>
            </section>
            <section className="card" style={{ marginTop: 18 }}>
              <h2>Konusma segmentleri</h2>
              <p style={{ color: 'var(--muted)' }}>
                Vatandasla baslayan her sohbetin nasil sonuclandigi: AI tamamladi mi, operatore mi dustu, yoksa eksik bilgi mi bekliyor.
              </p>
              <div className="grid" style={{ marginTop: 12 }}>
                <article className="card">
                  <p>AI tamamladi</p>
                  <p className="kpi">{segments.aiCompleted}</p>
                  <p style={{ color: 'var(--muted)' }}>Asistan eksiksiz topladi, ticket otomatik acildi.</p>
                </article>
                <article className="card">
                  <p>Operatore dustu</p>
                  <p className="kpi" style={{ color: 'var(--accent)' }}>{segments.operatorHandoff}</p>
                  <p style={{ color: 'var(--muted)' }}>Vatandas insan destegi istedi veya AI handoff onerdi.</p>
                </article>
                <article className="card">
                  <p>Eksik bilgi bekliyor</p>
                  <p className="kpi">{segments.awaitingInfo}</p>
                  <p style={{ color: 'var(--muted)' }}>Sohbet acik; takip sorusu vatandas cevabi bekliyor.</p>
                </article>
                <article className="card">
                  <p>Otomasyon orani</p>
                  <p className="kpi" style={{ color: 'var(--accent)' }}>{formatPercent(segments.automationRate)}</p>
                  <p style={{ color: 'var(--muted)' }}>Toplam {segments.totalConversations} konusmanin AI ile sonuclanan orani.</p>
                </article>
              </div>
            </section>
            <section className="card" style={{ marginTop: 18 }}>
              <h2>Kanal performansi</h2>
              {noChannelData ? (
                <div className="empty-state">
                  <strong>Kanal verisi henuz yok.</strong>
                  <p>Web widget, WhatsApp ve diger kanallardan akis basladiginda her kanalin ticket, konusma ve otomasyon orani burada listelenir.</p>
                </div>
              ) : (
                <div className="responsive-list">
                  {channelRows.map((row) => (
                    <div className="queue-row" key={row.channel}>
                      <strong>{channelLabels[row.channel] ?? row.channel}</strong>
                      <span>{row.tickets} ticket</span>
                      <span>{row.conversations} konusma</span>
                      <span>{row.publicMessages} mesaj</span>
                      <span>Otomasyon: {formatPercent(row.automationRate)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="card" style={{ marginTop: 18 }}>
              <h2>Durum dagilimi</h2>
              {statusRows.length ? (
                <div className="responsive-list">
                  {statusRows.map((row) => (
                    <div className="queue-row" key={row.status}>
                      <strong>{row.status}</strong>
                      <span>{row.count} kayit</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>Durum dagilimi hazir degil.</strong>
                  <p>Canli ticket verisi olustukca hangi asamada ne kadar kayit oldugu burada gorulecek.</p>
                </div>
              )}
            </section>
            <section className="card" style={{ marginTop: 18 }}>
              <h2>Birim ve kategori yogunlugu</h2>
              {departmentRows.length || categoryRows.length ? (
                <div className="grid">
                  <article className="subpanel">
                    <h3>Aktif birimler</h3>
                    <div className="responsive-list">
                      {departmentRows.map((row) => (
                        <div className="queue-row compact-row" key={row.id}>
                          <strong>{row.name}</strong>
                          <span>{row.code}</span>
                          <span>{row.openTickets} acik is</span>
                        </div>
                      ))}
                    </div>
                  </article>
                  <article className="subpanel">
                    <h3>Yogun kategoriler</h3>
                    <div className="responsive-list">
                      {categoryRows.map((row) => (
                        <div className="queue-row compact-row" key={row.id}>
                          <strong>{row.name}</strong>
                          <span>{row.departmentName ?? 'Birim yok'}</span>
                          <span>{row.tickets} kayit</span>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              ) : (
                <div className="empty-state">
                  <strong>Birim veya kategori dagilimi henuz yok.</strong>
                  <p>Tenant yapilandirmasi ve canli talepler arttikca is yuku dagilimi burada gorunur.</p>
                </div>
              )}
            </section>
            <section className="card" style={{ marginTop: 18 }}>
              <h2>Operasyon yorumu</h2>
              {noOperationalData ? (
                <div className="empty-state">
                  <strong>Raporlanacak canli veri yok.</strong>
                  <p>Basvurular API'den gelmeye basladiginda acik yuk, gunluk giris, cozum ve SLA alarmi burada belediye yonetimi icin ozetlenecek.</p>
                </div>
              ) : (
                <ul>
                  <li>{overview.slaDueSoon} kayit SLA suresine yaklasiyor; ekip planlamasinda onceliklendirin.</li>
                  <li>{overview.slaBreached} kayit SLA disina cikmis gorunuyor; birim sorumlularina eskalasyon gerekebilir.</li>
                  <li>{overview.resolvedToday} kayit bugun sonuclandi; kapanis sonrasi vatandas bilgilendirmesi kontrol edilmeli.</li>
                </ul>
              )}
            </section>
          </>
        ) : null}
    </AdminShell>
  );
}
