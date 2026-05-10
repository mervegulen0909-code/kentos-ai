import Link from 'next/link';
import { canAssignTickets, resolveAdminSession } from '../../../lib/session';
import { PendingFieldset, PendingSubmitButton } from '../../components/form-controls';
import { AdminShell } from '../../components/admin-shell';
import { createTicketFromHandoffAction } from '../actions';
import { adminApi, formatMissingFieldLabel } from '../../../lib/api';

const channelCopy: Record<string, string> = {
  WEB_CHAT: 'Web chat',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-posta',
  PHONE: 'Telefon',
  SMS: 'SMS',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
};

function formatDate(value: string | null) {
  if (!value) return 'Zaman bilgisi yok';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

type FeedbackCopy = { title: string; detail: string };

const errorCopy: Record<string, FeedbackCopy> = {
  session: {
    title: 'Oturum gerekli.',
    detail: 'Ticket olusturmak icin yeniden giris yapin; guvenlik nedeniyle islem gonderilmedi.',
  },
  forbidden: {
    title: 'Bu islem rol kapsaminizin disinda.',
    detail: 'Operator devrinden ticket olusturma izni yalnizca yonetici ve operator rollerine aciktir.',
  },
  'create-ticket': {
    title: 'Ticket olusturulamadi.',
    detail: 'Konusma ozetinde yeterli aciklama olmayabilir veya bu handoff icin zaten ticket uretilmis olabilir.',
  },
  general: {
    title: 'Islem tamamlanamadi.',
    detail: 'Baglanti, yetki veya handoff durumu nedeniyle ticket olusturma istegi kaydedilemedi.',
  },
};

export default async function HandoffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await resolveAdminSession();
  const hasSession = Boolean(session);
  const token = session?.accessToken ?? null;
  const role = session?.user.role ?? null;
  const canCreateTicket = canAssignTickets(role);
  let dataUnavailable = false;

  const handoff = token
    ? await adminApi.handoff(token, id).catch(() => {
        dataUnavailable = true;
        return null;
      })
    : null;

  return (
    <AdminShell hasSession={hasSession} role={role}>
        <p className="badge">Operator devri detayi</p>
        <h1>Konusma gecmisi ve AI ozetleri</h1>
        <p style={{ color: 'var(--muted)' }}>
          <Link href="/handoffs">← Tum devri bekleyen konusmalara don</Link>
        </p>
        {!hasSession ? (
          <div className="notice muted" role="note">
            <strong>Canli detay icin oturum gerekli.</strong>
            <p>Bu sayfa yalnizca yetkili session cookie ile operatore acilan konusma ozetini gosterir.</p>
          </div>
        ) : null}
        {dataUnavailable ? (
          <div className="notice error" role="alert">
            <strong>Konusma detayi alinamadi.</strong>
            <p>Handoff kaydi okunamadi; oturum, tenant yetkisi veya API baglantisini kontrol edin.</p>
          </div>
        ) : null}
        {error ? (
          <div className="notice error" role="alert">
            <strong>{(errorCopy[error] ?? errorCopy.general).title}</strong>
            <p>{(errorCopy[error] ?? errorCopy.general).detail}</p>
          </div>
        ) : null}
        {handoff ? (
          <>
            <section className="grid">
              <article className="card">
                <p>Kisi</p>
                <p className="kpi" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.4rem)' }}>{handoff.citizen.displayName ?? 'Anonim'}</p>
                <p style={{ color: 'var(--muted)' }}>{handoff.citizen.phone ?? handoff.citizen.email ?? 'Iletisim bilgisi bekleniyor'}</p>
              </article>
              <article className="card">
                <p>Kanal</p>
                <p className="kpi" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.4rem)' }}>{channelCopy[handoff.channel] ?? handoff.channel}</p>
                <p style={{ color: 'var(--muted)' }}>Son mesaj: {formatDate(handoff.lastMessageAt ?? handoff.createdAt)}</p>
              </article>
              <article className="card">
                <p>Takip baglantisi</p>
                <p className="kpi" style={{ fontSize: 'clamp(1.2rem, 3vw, 2rem)' }}>{handoff.trackingToken ?? 'Henüz ticket yok'}</p>
                <p style={{ color: 'var(--muted)' }}>Mevcut ticket varsa vatandas takip akisiyle eslesir.</p>
              </article>
            </section>

            <div className="grid" style={{ marginTop: 18 }}>
              <section className="card">
                <h2>AI degerlendirmesi</h2>
                <p><strong>Intent:</strong> {handoff.latestIntent ?? 'Bilinmiyor'}</p>
                <p><strong>Onerilen baslik:</strong> {handoff.classificationTitle ?? 'Yok'}</p>
                <p><strong>Ozet:</strong> {handoff.classificationDescription ?? handoff.latestCitizenMessage ?? 'Aciklama yok'}</p>
                <p><strong>Takip sorusu:</strong> {handoff.followUpQuestion ?? 'Yok'}</p>
                <p><strong>Eksik alanlar:</strong> {handoff.missingFields.length ? handoff.missingFields.map((field) => formatMissingFieldLabel(field as never) ?? field).join(', ') : 'Eksik alan yok'}</p>
              </section>
              <section className="card">
                <h2>Konusma ozeti</h2>
                <p><strong>Durum:</strong> {handoff.state}</p>
                <p><strong>Harici konusma no:</strong> {handoff.externalConversationId ?? 'Yok'}</p>
                <p><strong>Toplam mesaj:</strong> {handoff.messageCount}</p>
                <p><strong>Olusturulma:</strong> {formatDate(handoff.createdAt)}</p>
                <p><strong>Guncelleme:</strong> {formatDate(handoff.updatedAt)}</p>
              </section>
            </div>

            <section className="card" style={{ marginTop: 18 }}>
              <h2>Operator aksiyonu</h2>
              {handoff.trackingToken ? (
                <div className="notice success" role="status">
                  <strong>Bu konusma zaten ticket'a donusmus.</strong>
                  <p>
                    Takip kodu mevcut: {handoff.trackingToken}. Operasyon akisina <Link href="/tickets">talep listesi</Link> ekranindan devam edebilirsiniz.
                  </p>
                </div>
              ) : (
                <form action={createTicketFromHandoffAction} style={{ display: 'grid', gap: 10 }}>
                  <PendingFieldset style={{ display: 'grid', gap: 10 }}>
                    <input type="hidden" name="handoffId" value={handoff.id} />
                    <p style={{ margin: 0, color: 'var(--muted)' }}>
                      AI ozetini ve vatandas mesaj gecmisini kullanarak standart ticket kaydi olusturur. Olusan kayit dogrudan operasyon talep ekranina acilir.
                    </p>
                    <PendingSubmitButton
                      type="submit"
                      disabled={!canCreateTicket}
                      idleLabel="Bu konusmadan ticket olustur"
                      pendingLabel="Ticket olusturuluyor..."
                    />
                  </PendingFieldset>
                </form>
              )}
            </section>

            <section className="card" style={{ marginTop: 18 }}>
              <h2>Mesaj akisi</h2>
              {handoff.messages.length ? (
                <div className="responsive-list">
                  {handoff.messages.map((message, index) => (
                    <article className="timeline-item" key={`${message.at ?? 'na'}-${index}`}>
                      <strong>{message.role === 'citizen' ? 'Vatandas' : 'Asistan'}</strong>
                      <time>{formatDate(message.at)}</time>
                      <p style={{ margin: 0, color: 'var(--muted)' }}>{message.text}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>Konusma gecmisi yok.</strong>
                  <p>Bu handoff kaydinda henüz mesaja donusen bir konusma akisi bulunmuyor.</p>
                </div>
              )}
            </section>
          </>
        ) : null}
    </AdminShell>
  );
}
