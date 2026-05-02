import { citizenApi } from '../../../../lib/api';

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

export default async function PublicTicketPage({ params }: { params: Promise<{ tenantSlug: string; ticketNo: string }> }) {
  const { tenantSlug, ticketNo } = await params;
  const ticket = await citizenApi.getTicket(tenantSlug, ticketNo).catch(() => null);
  const statusMessage = ticket ? (citizenStatusCopy[ticket.status] ?? citizenStatusCopy.NEW) : null;

  return (
    <main className="wrap">
      <section className="card">
        <p style={{ color: 'var(--muted)', fontWeight: 700 }}>{tenantSlug} · {ticketNo}</p>
        <h1>{ticket ? ticket.title : 'Bu numarayla başvuru bulunamadı.'}</h1>
        <p>
          {ticket
            ? `${statusMessage?.title} ${statusMessage?.detail}`
            : 'Numarayı kısa çizgileriyle birlikte kontrol edin. Numara doğruysa kayıt henüz takip ekranına düşmemiş veya belediye sistemi kısa süreli meşgul olabilir; biraz sonra yeniden deneyin.'}
        </p>
        {ticket?.departmentName ? <p className="notice" role="status">Başvurunuz {ticket.departmentName} tarafından takip ediliyor.</p> : null}
        <div style={{ display: 'grid', gap: 12, marginTop: 24 }}>
          {(ticket?.publicMessages.length ? ticket.publicMessages : [{ body: 'Başvurunuz kayda alındı.', createdAt: ticket?.createdAt ?? '', senderType: 'SYSTEM' }]).map((message, index) => (
            <div key={`${message.createdAt}-${index}`} style={{ border: '1px solid var(--line)', borderRadius: 18, padding: 16 }}>
              <strong>{message.senderType === 'CITIZEN' ? 'Vatandaş mesajı' : 'Belediye bilgilendirmesi'}</strong>
              <p style={{ color: 'var(--muted)' }}>{message.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
