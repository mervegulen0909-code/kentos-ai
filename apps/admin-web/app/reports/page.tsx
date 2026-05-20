import {
  adminApi,
  type AnalyticsAiUsage,
  type AnalyticsCategorySummary,
  type AnalyticsChannelSummary,
  type AnalyticsConversationSegments,
  type AnalyticsDepartmentSummary,
  type AnalyticsOutboundDeliveries,
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

const fallbackAiUsage: AnalyticsAiUsage = {
  generatedAt: new Date(0).toISOString(),
  windows: {
    last24h: { runs: 0, successCount: 0, failureCount: 0, successRate: 0, tokensTotal: 0, costMicros: 0, averageLatencyMs: 0 },
    last7d: { runs: 0, successCount: 0, failureCount: 0, successRate: 0, tokensTotal: 0, costMicros: 0, averageLatencyMs: 0 },
    last30d: { runs: 0, successCount: 0, failureCount: 0, successRate: 0, tokensTotal: 0, costMicros: 0, averageLatencyMs: 0 },
  },
  byProvider: [],
};

const fallbackOutboundDeliveries: AnalyticsOutboundDeliveries = {
  total: 0,
  pending: 0,
  dispatched: 0,
  delivered: 0,
  failed: 0,
  skipped: 0,
  byChannel: [],
  recentFailures: [],
};

function formatCostMicrosAsTl(value: number) {
  // 1 micro = 1 / 1_000_000 USD; we display as USD cents-equivalent.
  // Operator can convert to TRY per their accounting; the dashboard remains denominated in USD micros.
  return `$${(value / 1_000_000).toFixed(4)}`;
}

const channelLabels: Record<string, string> = {
  WEB_CHAT: 'Web sohbet',
  WHATSAPP: 'WhatsApp',
  CITIZEN_WEB: 'Vatandas portali',
  MOBILE_APP: 'Mobil uygulama',
  OPERATOR: 'Operator',
  INSTAGRAM: 'Instagram DM',
  FACEBOOK: 'Facebook DM',
  SMS: 'SMS',
  EMAIL: 'E-posta',
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

  const [overview, channelSummary, departmentSummary, categorySummary, segments, aiUsage, outboundDeliveries] = token && analyticsVisible
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
        adminApi.aiUsage(token).catch(() => {
          dataUnavailable = true;
          return fallbackAiUsage;
        }),
        adminApi.outboundDeliveries(token).catch(() => {
          dataUnavailable = true;
          return fallbackOutboundDeliveries;
        }),
      ])
    : [fallbackOverview, fallbackChannels, fallbackDepartments, fallbackCategories, fallbackSegments, fallbackAiUsage, fallbackOutboundDeliveries];

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
                <article className="subpanel">
                  <p>AI tamamladi</p>
                  <p className="kpi">{segments.aiCompleted}</p>
                  <p style={{ color: 'var(--muted)' }}>Asistan eksiksiz topladi, ticket otomatik acildi.</p>
                </article>
                <article className="subpanel">
                  <p>Operatore dustu</p>
                  <p className="kpi" style={{ color: 'var(--accent)' }}>{segments.operatorHandoff}</p>
                  <p style={{ color: 'var(--muted)' }}>Vatandas insan destegi istedi veya AI handoff onerdi.</p>
                </article>
                <article className="subpanel">
                  <p>Eksik bilgi bekliyor</p>
                  <p className="kpi">{segments.awaitingInfo}</p>
                  <p style={{ color: 'var(--muted)' }}>Sohbet acik; takip sorusu vatandas cevabi bekliyor.</p>
                </article>
                <article className="subpanel">
                  <p>Otomasyon orani</p>
                  <p className="kpi" style={{ color: 'var(--accent)' }}>{formatPercent(segments.automationRate)}</p>
                  <p style={{ color: 'var(--muted)' }}>Toplam {segments.totalConversations} konusmanin AI ile sonuclanan orani.</p>
                </article>
              </div>
            </section>
            <section className="card" style={{ marginTop: 18 }}>
              <h2>AI kullanim ve maliyet</h2>
              <p style={{ color: 'var(--muted)' }}>
                Vatandas intake siniflandirmasi icin yapilan model cagrilarinin saglik metrikleri. Maliyet, modelin liste fiyatina gore mikro-dolar tahminidir; tenant anlasmasina gore yeniden hesaplayin.
              </p>
              <div className="grid" style={{ marginTop: 12 }}>
                <article className="subpanel">
                  <p>Son 24 saat - calisma</p>
                  <p className="kpi">{aiUsage.windows.last24h.runs}</p>
                  <p style={{ color: 'var(--muted)' }}>Basari orani: {formatPercent(aiUsage.windows.last24h.successRate)}</p>
                </article>
                <article className="subpanel">
                  <p>Son 24 saat - tahmini maliyet</p>
                  <p className="kpi">{formatCostMicrosAsTl(aiUsage.windows.last24h.costMicros)}</p>
                  <p style={{ color: 'var(--muted)' }}>{aiUsage.windows.last24h.tokensTotal} token</p>
                </article>
                <article className="card">
                  <p>Son 7 gun - calisma</p>
                  <p className="kpi">{aiUsage.windows.last7d.runs}</p>
                  <p style={{ color: 'var(--muted)' }}>Ortalama gecikme: {aiUsage.windows.last7d.averageLatencyMs} ms</p>
                </article>
                <article className="card">
                  <p>Son 30 gun - tahmini maliyet</p>
                  <p className="kpi">{formatCostMicrosAsTl(aiUsage.windows.last30d.costMicros)}</p>
                  <p style={{ color: 'var(--muted)' }}>{aiUsage.windows.last30d.tokensTotal} token / {aiUsage.windows.last30d.runs} cagri</p>
                </article>
              </div>
              {aiUsage.byProvider.length ? (
                <div className="responsive-list" style={{ marginTop: 12 }}>
                  {aiUsage.byProvider.map((row) => (
                    <div className="queue-row" key={row.provider}>
                      <strong>{row.provider}</strong>
                      <span>{row.runs} cagri</span>
                      <span>Basari: {formatPercent(row.successRate)}</span>
                      <span>{row.tokensTotal} token</span>
                      <span>{formatCostMicrosAsTl(row.costMicros)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ marginTop: 12 }}>
                  <strong>Son 30 gunde AI cagrisi yok.</strong>
                  <p>Stub fallback'a dustugunde de buraya kayit gelir; bos gorunmesi henuz hic intake yapilmadigi anlamina gelir.</p>
                </div>
              )}
            </section>
            <section className="card" style={{ marginTop: 18 }}>
              <h2>Disa giden teslimatlar</h2>
              <p style={{ color: 'var(--muted)' }}>
                WhatsApp, SMS, e-posta ve sosyal kanal yanitlarinin kuyruk ve gateway durumlari. Basarisiz teslimatlar son hata mesaji ve deneme sayisiyla operator incelemesine acilir.
              </p>
              <div className="grid" style={{ marginTop: 12 }}>
                <article className="subpanel">
                  <p>Toplam teslimat</p>
                  <p className="kpi">{outboundDeliveries.total}</p>
                  <p style={{ color: 'var(--muted)' }}>{outboundDeliveries.pending} kuyrukta / {outboundDeliveries.skipped} atlandi</p>
                </article>
                <article className="subpanel">
                  <p>Gateway'e giden</p>
                  <p className="kpi">{outboundDeliveries.dispatched}</p>
                  <p style={{ color: 'var(--muted)' }}>{outboundDeliveries.delivered} teslim edildi olarak isaretli</p>
                </article>
                <article className="subpanel">
                  <p>Basarisiz</p>
                  <p className="kpi" style={{ color: outboundDeliveries.failed ? 'var(--danger)' : 'var(--accent)' }}>{outboundDeliveries.failed}</p>
                  <p style={{ color: 'var(--muted)' }}>Son hata bilgisi review listesinde tutulur.</p>
                </article>
              </div>
              {outboundDeliveries.byChannel.length ? (
                <div className="responsive-list" style={{ marginTop: 12 }}>
                  {outboundDeliveries.byChannel.map((row) => (
                    <div className="queue-row" key={row.channel}>
                      <strong>{channelLabels[row.channel] ?? row.channel}</strong>
                      <span>{row.total} toplam</span>
                      <span>{row.pending} bekliyor</span>
                      <span>{row.dispatched + row.delivered} gitti</span>
                      <span>{row.failed} basarisiz</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ marginTop: 12 }}>
                  <strong>Outbound teslimat kaydi yok.</strong>
                  <p>Vatandas kanallarina otomatik yanitlar kuyruga alininca teslimat durumlari burada gorunur.</p>
                </div>
              )}
              {outboundDeliveries.recentFailures.length ? (
                <div className="responsive-list" style={{ marginTop: 12 }} aria-label="Son basarisiz outbound teslimatlar">
                  {outboundDeliveries.recentFailures.map((failure) => (
                    <div className="queue-row" key={failure.id}>
                      <strong>{channelLabels[failure.channel] ?? failure.channel}</strong>
                      <span>{failure.attempts} deneme</span>
                      <span>{failure.lastError ?? 'Hata mesaji yok'}</span>
                    </div>
                  ))}
                </div>
              ) : null}
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
