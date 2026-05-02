import { adminApi } from '../../lib/api';
import { getSessionToken } from '../../lib/session';

const fallbackOverview = {
  totalOpen: 0,
  openedToday: 0,
  resolvedToday: 0,
  slaBreached: 0,
  slaDueSoon: 0,
};

export default async function ReportsPage() {
  const token = await getSessionToken();
  let dataUnavailable = false;
  const overview = token
    ? await adminApi.overview(token).catch(() => {
        dataUnavailable = true;
        return fallbackOverview;
      })
    : fallbackOverview;
  const noOperationalData = !overview.totalOpen && !overview.openedToday && !overview.resolvedToday && !overview.slaBreached && !overview.slaDueSoon;

  return (
    <main className="main">
      <p className="badge">Operasyon raporları · SLA ve çözüm görünümü</p>
      <h1>Günlük belediye operasyon raporu</h1>
      {!token ? (
        <div className="notice muted" role="note">
          <strong>Canlı rapor için oturum gerekli.</strong>
          <p>Yetkili kullanıcı girişi yapılana kadar ham API hatası veya iç veri gösterilmez.</p>
        </div>
      ) : null}
      {dataUnavailable ? (
        <div className="notice error" role="alert">
          <strong>Rapor verisi alınamadı.</strong>
          <p>Canlı API yanıtı şu an kullanılamıyor; teknik ayrıntı gizlendi. Bağlantı veya yetki durumunu kontrol edin.</p>
        </div>
      ) : null}
      <section className="grid" aria-label="Rapor KPI kartları">
        <article className="card">
          <p>Açık operasyon yükü</p>
          <p className="kpi">{overview.totalOpen}</p>
          <p style={{ color: 'var(--muted)' }}>Birimlerde aktif takip bekleyen toplam başvuru.</p>
        </article>
        <article className="card">
          <p>Bugün açılan</p>
          <p className="kpi">{overview.openedToday}</p>
          <p style={{ color: 'var(--muted)' }}>Günün yeni vatandaş talebi hacmi.</p>
        </article>
        <article className="card">
          <p>Bugün sonuçlanan</p>
          <p className="kpi">{overview.resolvedToday}</p>
          <p style={{ color: 'var(--muted)' }}>Çözüm bildirilen veya kapatmaya yaklaşan işler.</p>
        </article>
        <article className="card">
          <p>SLA alarmı</p>
          <p className="kpi" style={{ color: overview.slaBreached ? 'var(--danger)' : 'var(--accent)' }}>{overview.slaBreached}</p>
          <p style={{ color: 'var(--muted)' }}>Süresi aşılmış ve yönetici takibi isteyen kayıtlar.</p>
        </article>
      </section>
      <section className="card" style={{ marginTop: 18 }}>
        <h2>Operasyon yorumu</h2>
        {noOperationalData ? (
          <div className="empty-state">
            <strong>Raporlanacak canlı veri yok.</strong>
            <p>Başvurular API’den gelmeye başladığında açık yük, günlük giriş, çözüm ve SLA alarmı burada belediye yönetimi için özetlenecek.</p>
          </div>
        ) : (
          <ul>
            <li>{overview.slaDueSoon} kayıt SLA süresine yaklaşıyor; ekip planlamasında önceliklendirin.</li>
            <li>{overview.slaBreached} kayıt SLA dışına çıkmış görünüyor; birim sorumlularına eskalasyon gerekebilir.</li>
            <li>{overview.resolvedToday} kayıt bugün sonuçlandı; kapanış sonrası vatandaş bilgilendirmesi kontrol edilmeli.</li>
          </ul>
        )}
      </section>
    </main>
  );
}
