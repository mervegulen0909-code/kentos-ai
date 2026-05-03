import { ApiError, citizenApi } from '../../../../lib/api';

const citizenStatusCopy: Record<string, { title: string; detail: string }> = {
  NEW: {
    title: 'Başvurunuz alındı.',
    detail: 'Belediye ekibi başvurunuzu ön incelemeye hazırlıyor.',
  },
  TRIAGED: {
    title: 'Başvurunuz inceleniyor.',
    detail: 'Talebiniz doğru birime yönlendirilmek üzere değerlendiriliyor.',
  },
  ASSIGNED: {
    title: 'Başvurunuz ilgili birime iletildi.',
    detail: 'Yetkili belediye birimi konuyu takip ediyor.',
  },
  IN_PROGRESS: {
    title: 'Başvurunuz üzerinde çalışılıyor.',
    detail: 'Ekipler gerekli işlem veya saha kontrolü için süreci sürdürüyor.',
  },
  WAITING_INFO: {
    title: 'Ek bilgi bekleniyor.',
    detail: 'Belediye ekibi başvurunuzu tamamlamak için sizden bilgi isteyebilir.',
  },
  RESOLVED: {
    title: 'Çözüm bildirildi.',
    detail: 'Başvurunuz için belediye tarafından sonuç bilgisi paylaşıldı.',
  },
  CLOSED: {
    title: 'Başvurunuz kapatıldı.',
    detail: 'Bu kayıt için işlem süreci tamamlandı.',
  },
  REJECTED: {
    title: 'Başvurunuz işleme alınamadı.',
    detail: 'Kayıt belediye değerlendirmesi sonucunda bu kanaldan ilerletilemedi.',
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

export default async function PublicTicketPage({ params }: { params: Promise<{ tenantSlug: string; ticketNo: string }> }) {
  const { tenantSlug, ticketNo: trackingToken } = await params;
  const ticketState = await getTicketState(tenantSlug, trackingToken);
  const ticket = ticketState.kind === 'success' ? ticketState.ticket : null;
  const statusMessage = ticket ? (citizenStatusCopy[ticket.status] ?? citizenStatusCopy.NEW) : null;
  const displayedReference = ticket?.trackingToken ?? (trackingToken.startsWith('TK-') ? trackingToken : null);

  return (
    <main className="wrap">
      <section className="card">
        <p style={{ color: 'var(--muted)', fontWeight: 700 }}>
          {displayedReference ? `${tenantSlug} - ${displayedReference}` : `${tenantSlug} başvuru takibi`}
        </p>
        <h1>
          {ticketState.kind === 'success'
            ? ticketState.ticket.title
            : ticketState.kind === 'not-found'
              ? 'Bu takip koduyla başvuru bulunamadı.'
              : 'Başvuru durumu şu an gösterilemiyor.'}
        </h1>
        <p>
          {ticketState.kind === 'success'
            ? `${statusMessage?.title} ${statusMessage?.detail}`
            : ticketState.kind === 'not-found'
              ? 'Takip kodunu kısa çizgisiyle birlikte kontrol edin. Kod doğruysa bu kayıt henüz takip ekranına düşmemiş olabilir.'
              : 'Belediye takip servisine şu anda ulaşılamıyor olabilir. Biraz sonra yeniden deneyin.'}
        </p>
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
        {ticket?.trackingToken ? (
          <p className="notice" role="status">Takip kodunuz: {ticket.trackingToken}</p>
        ) : null}
        {ticket?.departmentName ? <p className="notice" role="status">Başvurunuz {ticket.departmentName} tarafından takip ediliyor.</p> : null}
        {ticket ? (
          <div style={{ display: 'grid', gap: 12, marginTop: 24 }}>
            {(ticket.publicMessages.length ? ticket.publicMessages : [{ body: 'Başvurunuz kayda alındı.', createdAt: ticket.createdAt, author: 'municipality' as const }]).map((message, index) => (
              <div key={`${message.createdAt}-${index}`} style={{ border: '1px solid var(--line)', borderRadius: 18, padding: 16 }}>
                <strong>{message.author === 'citizen' ? 'Vatandaş mesajı' : 'Belediye bilgilendirmesi'}</strong>
                <p style={{ color: 'var(--muted)' }}>{message.body}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
