import { adminApi } from '../../lib/api';
import { canManageSettings, canViewAnalytics, getAdminSession, resolveAdminAccessToken } from '../../lib/session';

const fallbackOverview = {
  totalOpen: 0,
  openedToday: 0,
  resolvedToday: 0,
  slaBreached: 0,
  slaDueSoon: 0,
  byStatus: [] as Array<{ status: string; count: number }>,
};

export default async function ReportsPage() {
  const session = await getAdminSession();
  const hasSession = Boolean(session);
  const token = hasSession ? await resolveAdminAccessToken() : null;
  const role = session?.user.role ?? null;
  const analyticsVisible = canViewAnalytics(role);
  const settingsVisible = hasSession && canManageSettings(role);
  let dataUnavailable = false;

  const overview = token && analyticsVisible
    ? await adminApi.overview(token).catch(() => {
        dataUnavailable = true;
        return fallbackOverview;
      })
    : fallbackOverview;

  const noOperationalData = !overview.totalOpen && !overview.openedToday && !overview.resolvedToday && !overview.slaBreached && !overview.slaDueSoon;
  const statusRows = overview.byStatus
    .slice()
    .sort((left, right) => right.count - left.count);

  return (
    <main className="shell">
      <aside className="sidebar">
        <h1>KentOS AI</h1>
        <p style={{ color: 'var(--muted)' }}>Operasyon komuta paneli</p>
        <nav style={{ display: 'grid', gap: 12, marginTop: 32 }}>
          <a href="/">Dashboard</a>
          <a href="/tickets">Talepler</a>
          <a href="/handoffs">Operator devri</a>
          <a href="/queues">Birim kuyruklari</a>
          {analyticsVisible ? <a href="/reports">Raporlar</a> : null}
          {settingsVisible ? <a href="/settings">Ayarlar</a> : null}
        </nav>
      </aside>
      <section className="main">
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
      </section>
    </main>
  );
}
