import Link from 'next/link';
import { ApiError, citizenApi } from '../../../../lib/api';

const citizenScanLabels: Record<string, string> = {
  PENDING: '(Tarama bekleniyor)',
  CLEAN: '(Tarama: temiz)',
  INFECTED: '(Engellendi - guvenli olmayan icerik)',
  ERROR: '(Tarama hatasi)',
  SKIPPED: '(Tarama atlandi)',
};

function citizenScanLabel(scanStatus: string | null | undefined) {
  if (!scanStatus) return '';
  return citizenScanLabels[scanStatus] ?? `(${scanStatus})`;
}

const citizenStatusCopy: Record<string, { title: string; detail: string; tone: 'progress' | 'warning' | 'success' | 'neutral' | 'danger' }> = {
  NEW: {
    title: 'Başvurunuz alındı.',
    detail: 'Belediye ekibi başvurunuzu ön incelemeye hazırlıyor.',
    tone: 'progress',
  },
  TRIAGED: {
    title: 'Başvurunuz inceleniyor.',
    detail: 'Talebiniz doğru birime yönlendirilmek üzere değerlendiriliyor.',
    tone: 'progress',
  },
  ASSIGNED: {
    title: 'Başvurunuz ilgili birime iletildi.',
    detail: 'Yetkili belediye birimi konuyu takip ediyor.',
    tone: 'progress',
  },
  IN_PROGRESS: {
    title: 'Başvurunuz üzerinde çalışılıyor.',
    detail: 'Ekipler gerekli işlem veya saha kontrolü için süreci sürdürüyor.',
    tone: 'progress',
  },
  WAITING_INFO: {
    title: 'Ek bilgi bekleniyor.',
    detail: 'Belediye ekibi başvurunuzu tamamlamak için sizden bilgi isteyebilir.',
    tone: 'warning',
  },
  RESOLVED: {
    title: 'Çözüm bildirildi.',
    detail: 'Başvurunuz için belediye tarafından sonuç bilgisi paylaşıldı.',
    tone: 'success',
  },
  CLOSED: {
    title: 'Başvurunuz kapatıldı.',
    detail: 'Bu kayıt için işlem süreci tamamlandı.',
    tone: 'neutral',
  },
  REJECTED: {
    title: 'Başvurunuz işleme alınamadı.',
    detail: 'Kayıt belediye değerlendirmesi sonucunda bu kanaldan ilerletilemedi.',
    tone: 'danger',
  },
};

type TicketState =
  | { kind: 'success'; ticket: Awaited<ReturnType<typeof citizenApi.getTicket>> }
  | { kind: 'not-found' }
  | { kind: 'unavailable' };

async function getTicketState(tenantSlug: string, trackingToken: string): Promise<TicketState> {
  try {
    const ticket = await citizenApi.getTicket(tenantSlug, trackingToken);
    return { kind: 'success', ticket };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { kind: 'not-found' };
    }

    return { kind: 'unavailable' };
  }
}

function formatDate(date: string | null) {
  if (!date) return 'Henüz paylaşılmadı';

  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(date));
}

function getPriorityLabel(priority: string) {
  const priorityLabels: Record<string, string> = {
    LOW: 'Düşük öncelik',
    MEDIUM: 'Normal öncelik',
    HIGH: 'Yüksek öncelik',
    URGENT: 'Acil öncelik',
  };

  return priorityLabels[priority] ?? 'Öncelik atanmadı';
}

export default async function PublicTicketPage({ params }: { params: Promise<{ tenantSlug: string; trackingToken: string }> }) {
  const { tenantSlug, trackingToken } = await params;
  const ticketState = await getTicketState(tenantSlug, trackingToken);
  const ticket = ticketState.kind === 'success' ? ticketState.ticket : null;
  const statusMessage = ticket ? (citizenStatusCopy[ticket.status] ?? citizenStatusCopy.NEW) : null;
  const displayedReference = ticket?.trackingToken ?? (trackingToken.startsWith('TK-') ? trackingToken : null);
  const timeline = ticket
    ? (ticket.publicMessages.length
        ? ticket.publicMessages
        : [{ body: 'Başvurunuz kayda alındı. İnceleme süreci başladığında bu alanda güncellemeler görünecektir.', createdAt: ticket.createdAt, author: 'municipality' as const }])
    : [];

  return (
    <main className="wrap">
      <section className="hero ticket-layout">
        <div className={`card ticket-hero-card ${ticket ? '' : 'ticket-hero-card-empty'}`}>
          <div className="ticket-hero-copy">
            <p className="eyebrow">
              {displayedReference ? `${tenantSlug} · ${displayedReference}` : `${tenantSlug} · Başvuru takibi`}
            </p>
            <h1 className="display ticket-display-title">
              {ticket
                ? ticket.title
                : ticketState.kind === 'not-found'
                  ? 'Bu takip koduyla başvuru bulunamadı.'
                  : 'Başvuru durumu şu an gösterilemiyor.'}
            </h1>
            <p className="lede ticket-lede">
              {ticketState.kind === 'success'
                ? `${statusMessage?.title} ${statusMessage?.detail}`
                : ticketState.kind === 'not-found'
                  ? 'Takip kodunu kısa çizgisiyle birlikte kontrol edin. Kod doğruysa bu kayıt henüz takip ekranına düşmemiş olabilir.'
                  : 'Belediye takip servisine şu anda ulaşılamıyor olabilir. Biraz sonra yeniden deneyin.'}
            </p>
          </div>

          <div className="ticket-hero-actions">
            <Link className="secondary-cta" href={`/${tenantSlug}/track`}>Başka bir kod sorgula</Link>
            <Link className="secondary-cta" href={`/${tenantSlug}/report`}>Yeni başvuru oluştur</Link>
          </div>

          {ticketState.kind === 'not-found' ? (
            <div className="notice error" role="alert">
              <strong>Takip kodu eşleşmedi.</strong>
              <p>T.C. kimlik, telefon veya ad-soyad ile sorgulama yapılmaz; yalnızca başvuru sonunda verilen takip kodu kullanılır.</p>
            </div>
          ) : null}

          {ticketState.kind === 'unavailable' ? (
            <div className="notice error" role="alert">
              <strong>Geçici servis sorunu.</strong>
              <p>Teknik hata ayrıntısı gösterilmiyor. Sayfayı yenileyip biraz sonra yeniden deneyin.</p>
            </div>
          ) : null}

          {ticket ? (
            <>
              <div className="ticket-status-row" aria-label="Başvuru durumu özeti">
                <span className={`ticket-status-badge ticket-status-${statusMessage?.tone ?? 'neutral'}`}>{statusMessage?.title}</span>
                <span className="ticket-status-detail">{statusMessage?.detail}</span>
              </div>

              <div className="notice ticket-reference-note" role="status">
                <strong>Takip kodunuz: {ticket.trackingToken ?? 'Henüz atanmadı'}</strong>
                <p>Bu kod yalnızca bu başvuruya özeldir. Süreci tekrar görüntülemek için güvenli biçimde saklayın.</p>
              </div>

              <div className="ticket-meta-grid" aria-label="Başvuru özeti">
                <div className="ticket-meta-card">
                  <span>Takip kodu</span>
                  <strong>{ticket.trackingToken ?? 'Henüz atanmadı'}</strong>
                </div>
                <div className="ticket-meta-card">
                  <span>İlgili birim</span>
                  <strong>{ticket.departmentName ?? 'Yönlendirme sürüyor'}</strong>
                </div>
                <div className="ticket-meta-card">
                  <span>Kategori</span>
                  <strong>{ticket.categoryName ?? 'Sınıflandırma sürüyor'}</strong>
                </div>
                <div className="ticket-meta-card">
                  <span>Öncelik</span>
                  <strong>{getPriorityLabel(ticket.priority)}</strong>
                </div>
                <div className="ticket-meta-card">
                  <span>Kayıt zamanı</span>
                  <strong>{formatDate(ticket.createdAt)}</strong>
                </div>
                <div className="ticket-meta-card">
                  <span>Hedef çözüm zamanı</span>
                  <strong>{formatDate(ticket.resolutionDueAt)}</strong>
                </div>
              </div>

              {ticket.addressText ? (
                <div className="notice ticket-location-note" role="status">
                  <strong>Konum bilgisi alındı.</strong>
                  <p>{ticket.addressText}</p>
                </div>
              ) : null}
              {ticket.attachments?.length ? (
                <div className="notice ticket-location-note" role="status">
                  <strong>Ekler alindi.</strong>
                  <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                    {ticket.attachments.map((attachment) => (
                      <li key={attachment.id}>
                        {attachment.fileName} <small>{citizenScanLabel(attachment.scanStatus)}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <div className="ticket-empty-panel">
              <strong>Takip ekranı güvenli kod ile çalışır.</strong>
              <p>Elinizdeki TK kodunu kontrol ederek yeniden deneyin veya yeni bir başvuru oluşturun.</p>
            </div>
          )}
        </div>

        <section className="card ticket-timeline-card" aria-label="Başvuru geçmişi ve güncellemeler">
          <div className="ticket-section-heading">
            <p className="eyebrow">Vatandaş görünümü</p>
            <h2>Güncellemeler ve kayıt geçmişi</h2>
            <p>
              Bu alanda yalnızca vatandaşla paylaşılabilen açıklamalar gösterilir. İç operasyon notları burada yer almaz.
            </p>
          </div>

          {ticket ? (
            <div className="ticket-timeline-list">
              {timeline.map((message, index) => (
                <article className="ticket-timeline-item" key={`${message.createdAt}-${index}`}>
                  <div className={`ticket-timeline-marker ${message.author === 'citizen' ? 'ticket-timeline-marker-citizen' : 'ticket-timeline-marker-municipality'}`} aria-hidden="true" />
                  <div className="ticket-timeline-content">
                    <div className="ticket-timeline-header">
                      <strong>{message.author === 'citizen' ? 'Vatandaş mesajı' : 'Belediye bilgilendirmesi'}</strong>
                      <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
                    </div>
                    <p>{message.body}</p>
                    {message.attachments?.length ? (
                      <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                        {message.attachments.map((attachment) => (
                          <li key={attachment.id}>
                            {attachment.fileName} <small>{citizenScanLabel(attachment.scanStatus)}</small>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="ticket-empty-panel">
              <strong>Henüz gösterilecek bir kayıt yok.</strong>
              <p>Takip kodu doğrulandığında başvurunun vatandaşa açık güncellemeleri burada sıralanır.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
