import { adminApi, type HandoffSummary } from '../../lib/api';
import { canManageSettings, canViewAnalytics, getAdminSession, resolveAdminAccessToken } from '../../lib/session';

const fallbackRows: HandoffSummary[] = [];

const channelCopy: Record<string, string> = {
  WEB_CHAT: 'Web chat',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-posta',
  PHONE: 'Telefon',
  SMS: 'SMS',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
};

const intentCopy: Record<string, string> = {
  human_handoff: 'Insan destegi',
  new_ticket: 'Yeni basvuru',
  faq: 'Bilgi talebi',
  spam: 'Gecersiz icerik',
};

function formatDate(value: string | null) {
  if (!value) return 'Zaman bilgisi yok';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function summarizeContact(row: HandoffSummary) {
  return row.citizen.displayName ?? row.citizen.phone ?? row.citizen.email ?? 'Kimlik bilgisi bekleniyor';
}

export default async function HandoffsPage() {
  const session = await getAdminSession();
  const hasSession = Boolean(session);
  const token = hasSession ? await resolveAdminAccessToken() : null;
  const role = session?.user.role ?? null;
  const analyticsVisible = canViewAnalytics(role);
  const settingsVisible = hasSession && canManageSettings(role);
  let dataUnavailable = false;

  const rows = token
    ? await adminApi.handoffs(token).catch(() => {
        dataUnavailable = true;
        return fallbackRows;
      })
    : fallbackRows;

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
        <p className="badge">Operator devri · canli konusma kuyruğu</p>
        <h1>Insan destegi bekleyen gorusmeler</h1>
        {!hasSession ? (
          <div className="notice muted" role="note">
            <strong>Canli handoff kuyrugu icin oturum gerekli.</strong>
            <p>Bu ekran yalnizca yetkili session cookie akisi ile operator devri bekleyen konusmalari gosterir.</p>
          </div>
        ) : null}
        {dataUnavailable ? (
          <div className="notice error" role="alert">
            <strong>Operator devri verisi alinamadi.</strong>
            <p>API yaniti su an okunamiyor; oturum, tenant kapsami veya servis baglantisini kontrol edin.</p>
          </div>
        ) : null}
        <section className="card">
          <div className="ticket-list">
            {rows.length ? rows.map((row) => (
              <a key={row.id} href={`/handoffs/${row.id}`} className="ticket-list-row">
                <strong>{summarizeContact(row)}</strong>
                <span><span className="ticket-list-label">Son vatandas mesaji</span>{row.latestCitizenMessage ?? 'Vatandas mesaji kaydi yok'}</span>
                <span><span className="ticket-list-label">Kanal</span>{channelCopy[row.channel] ?? row.channel}</span>
                <span><span className="ticket-list-label">Niyet</span>{intentCopy[row.latestIntent ?? ''] ?? (row.latestIntent ?? 'Bilinmiyor')}</span>
                <span><span className="ticket-list-label">Son hareket</span>{formatDate(row.lastMessageAt ?? row.createdAt)}</span>
              </a>
            )) : (
              <div className="empty-state">
                <strong>Bekleyen operator devri yok.</strong>
                <p>AI insan destegi sinyali urettiginde ilgili konusmalar bu kuyrukta en guncel mesaja gore listelenecek.</p>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
