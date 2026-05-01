import { citizenApi } from '../../../../lib/api';

export default async function PublicTicketPage({ params }: { params: Promise<{ tenantSlug: string; ticketNo: string }> }) {
  const { tenantSlug, ticketNo } = await params;
  const ticket = await citizenApi.getTicket(tenantSlug, ticketNo).catch(() => null);

  return (
    <main className="wrap">
      <section className="card">
        <p style={{ color: 'var(--muted)', fontWeight: 700 }}>{tenantSlug} · {ticketNo}</p>
        <h1>{ticket ? ticket.title : 'Başvuru bilgisi şu an alınamadı.'}</h1>
        <p>
          {ticket
            ? `${ticket.status} durumundaki başvurunuz ${ticket.departmentName ?? 'ilgili belediye birimi'} tarafından takip ediliyor.`
            : 'API çalışmıyorsa bu ekran güvenli boş durum gösterir. Lütfen başvuru numaranızı kontrol edin veya daha sonra tekrar deneyin.'}
        </p>
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
