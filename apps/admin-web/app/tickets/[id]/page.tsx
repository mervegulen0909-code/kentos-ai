import { adminApi } from '../../../lib/api';
import { getSessionToken } from '../../../lib/session';
import { addInternalNoteAction, addPublicMessageAction, assignTicketAction, updateStatusAction } from '../actions';

const transitions: Record<string, string[]> = {
  NEW: ['TRIAGED', 'ASSIGNED', 'REJECTED'],
  TRIAGED: ['ASSIGNED', 'WAITING_INFO', 'REJECTED'],
  ASSIGNED: ['IN_PROGRESS', 'WAITING_INFO', 'REJECTED'],
  IN_PROGRESS: ['WAITING_INFO', 'RESOLVED', 'REJECTED'],
  WAITING_INFO: ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'REJECTED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
  REJECTED: [],
};

const statusCopy: Record<string, string> = {
  NEW: 'Yeni kayıt',
  TRIAGED: 'Ön incelemede',
  ASSIGNED: 'Birime atandı',
  IN_PROGRESS: 'İşlemde',
  WAITING_INFO: 'Vatandaştan bilgi bekleniyor',
  RESOLVED: 'Çözüm bildirildi',
  CLOSED: 'Kapatıldı',
  REJECTED: 'Reddedildi',
};

const slaCopy: Record<string, string> = {
  OK: 'SLA içinde',
  DUE_SOON: 'SLA yaklaşmakta',
  BREACHED: 'SLA aşıldı',
  UNKNOWN: 'SLA bilinmiyor',
};

const auditActionCopy: Record<string, string> = {
  'ticket.created': 'Talep oluşturuldu',
  'ticket.assigned': 'Talep birime atandı',
  'ticket.status_changed': 'Durum değiştirildi',
  'ticket.internal_note_added': 'İç not eklendi',
  'ticket.public_message_added': 'Vatandaş mesajı eklendi',
};

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

type FeedbackCopy = { title: string; detail: string };

const successCopy: Record<string, FeedbackCopy> = {
  'status-updated': {
    title: 'Durum güncellendi.',
    detail: 'Kuyruk ve talep detayı yenilendi; varsa vatandaş mesajı takip ekranında görünür.',
  },
  assigned: {
    title: 'Atama tamamlandı.',
    detail: 'Talep seçilen birimin operasyon kuyruğuna taşındı.',
  },
  'internal-note-added': {
    title: 'İç not kaydedildi.',
    detail: 'Bu not yalnızca personel ekranlarında görünür; vatandaş takip ekranına yansımaz.',
  },
  'public-message-sent': {
    title: 'Vatandaş bilgilendirmesi gönderildi.',
    detail: 'Mesaj takip ekranındaki belediye bilgilendirmeleri arasına eklendi.',
  },
};

const errorCopy: Record<string, FeedbackCopy> = {
  session: {
    title: 'Oturum gerekli.',
    detail: 'İşleme devam etmek için yeniden giriş yapın; form verisi güvenlik nedeniyle gönderilmedi.',
  },
  status: {
    title: 'Durum güncellenemedi.',
    detail: 'Seçilen geçiş bu talep için uygun olmayabilir veya opsiyonel vatandaş mesajı çok kısa olabilir.',
  },
  assignment: {
    title: 'Atama yapılamadı.',
    detail: 'Aktif bir birim seçildiğinden emin olun; pasif veya eksik birimlere atama yapılmaz.',
  },
  'internal-note': {
    title: 'İç not kaydedilemedi.',
    detail: 'Not metni boş olmamalı; operasyon geçmişi için kısa ama açıklayıcı bir kayıt girin.',
  },
  'public-message': {
    title: 'Vatandaş mesajı gönderilemedi.',
    detail: 'Mesaj metnini kontrol edin; vatandaş ekranında görüneceği için açık ve işlem odaklı yazın.',
  },
  general: {
    title: 'İşlem tamamlanamadı.',
    detail: 'Yetki, bağlantı veya kayıt durumunu kontrol edip işlemi tekrar deneyin.',
  },
};

export default async function TicketDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const { id } = await params;
  const { success, error } = await searchParams;
  const token = await getSessionToken();
  const ticket = token ? await adminApi.ticket(token, id).catch(() => null) : null;
  const auditLog = token ? await adminApi.auditLog(token, id).catch(() => []) : [];
  const departments = token ? await adminApi.departments(token).catch(() => []) : [];
  const statusOptions = ticket ? [ticket.status, ...(transitions[ticket.status] ?? [])] : [];
  const isTerminal = ticket?.status === 'CLOSED' || ticket?.status === 'REJECTED';
  const canMutateTicket = Boolean(ticket && !isTerminal);

  return (
    <main className="main">
      <p className="badge">Talep detayı · {ticket?.ticketNo ?? id}</p>
      <h1>{ticket?.title ?? 'Talep detayı için giriş yapın'}</h1>
      {token && ticket ? (
        <div className="notice muted" role="note">
          <strong>Yetki durumu API tarafından doğrulanır.</strong>
          <p>Bu ekranda rol bilgisi taşınmadığı için READ_ONLY veya kapsam dışı kullanıcı işlemleri backend guard tarafından reddedilir; hata mesajı güvenli biçimde gösterilir.</p>
        </div>
      ) : null}
      {success ? (
        <div className="notice success" role="status">
          <strong>{(successCopy[success] ?? { title: 'İşlem kaydedildi.', detail: 'Talep detayı güncel verilerle yenilendi.' }).title}</strong>
          <p>{(successCopy[success] ?? { title: 'İşlem kaydedildi.', detail: 'Talep detayı güncel verilerle yenilendi.' }).detail}</p>
        </div>
      ) : null}
      {error ? (
        <div className="notice error" role="alert">
          <strong>{(errorCopy[error] ?? errorCopy.general).title}</strong>
          <p>{(errorCopy[error] ?? errorCopy.general).detail}</p>
        </div>
      ) : null}
      <div className="grid">
        <section className="card">
          <h2>Durum</h2>
          <p>{ticket ? `${statusCopy[ticket.status] ?? ticket.status} · ${ticket.department?.name ?? 'Atanmamış'} · ${slaCopy[ticket.slaState ?? 'UNKNOWN'] ?? slaCopy.UNKNOWN}` : 'Oturum yok veya API erişilemiyor.'}</p>
          {isTerminal ? (
            <div className="notice muted" role="note">
              <strong>Bu talep son durumda.</strong>
              <p>Kapatılmış veya reddedilmiş taleplerde yeni atama, durum geçişi ve mesaj işlemleri backend guard tarafından kabul edilmez.</p>
            </div>
          ) : null}
          {ticket ? (
            <form action={updateStatusAction} style={{ display: 'grid', gap: 10 }}>
              <input type="hidden" name="intent" value="status" />
              <input type="hidden" name="ticketId" value={ticket.id} />
              <select name="status" defaultValue={ticket.status} disabled={!canMutateTicket}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{statusCopy[status] ?? status}</option>
                ))}
              </select>
              <input name="publicMessage" placeholder="Vatandaşa opsiyonel durum mesajı" disabled={!canMutateTicket} />
              <button type="submit" disabled={!canMutateTicket}>Durumu güncelle</button>
            </form>
          ) : null}
        </section>
        <section className="card">
          <h2>Atama</h2>
          {ticket ? (
            <form action={assignTicketAction} style={{ display: 'grid', gap: 10 }}>
              <input type="hidden" name="intent" value="assignment" />
              <input type="hidden" name="ticketId" value={ticket.id} />
              <select name="departmentId" defaultValue="" disabled={!canMutateTicket || !departments.length}>
                <option value="">Birim seçin</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
              <button type="submit" disabled={!canMutateTicket || !departments.length}>Birime ata</button>
            </form>
          ) : <p style={{ color: 'var(--muted)' }}>Atama için oturum gerekli.</p>}
        </section>
        <section className="card">
          <h2>Mesajlar</h2>
          {ticket?.messages?.length ? ticket.messages.map((message) => (
            <p key={message.id}><strong>{message.visibility === 'INTERNAL' ? 'İç not' : 'Vatandaş mesajı'}</strong> · {message.body}</p>
          )) : <p style={{ color: 'var(--muted)' }}>Mesaj yok.</p>}
        </section>
        <section className="card">
          <h2>İç not ekle</h2>
          <form action={addInternalNoteAction} style={{ display: 'grid', gap: 10 }}>
            <input type="hidden" name="intent" value="internal-note" />
            <input type="hidden" name="ticketId" value={ticket?.id ?? id} />
            <textarea name="body" rows={4} placeholder="Sadece personel görür" disabled={!canMutateTicket} />
            <button type="submit" disabled={!canMutateTicket}>Notu kaydet</button>
          </form>
        </section>
        <section className="card">
          <h2>Vatandaş mesajı</h2>
          <form action={addPublicMessageAction} style={{ display: 'grid', gap: 10 }}>
            <input type="hidden" name="intent" value="public-message" />
            <input type="hidden" name="ticketId" value={ticket?.id ?? id} />
            <textarea name="body" rows={4} placeholder="Vatandaş takip ekranında görünür" disabled={!canMutateTicket} />
            <button type="submit" disabled={!canMutateTicket}>Mesajı gönder</button>
          </form>
        </section>
        <section className="card">
          <h2>Audit timeline</h2>
          {auditLog.length ? auditLog.map((item) => (
            <div key={item.id} className="timeline-item">
              <strong>{auditActionCopy[item.action] ?? item.action}</strong>
              <time dateTime={item.createdAt}>{dateFormatter.format(new Date(item.createdAt))}</time>
            </div>
          )) : (
            <div className="empty-state">
              <strong>Henüz audit kaydı görünmüyor.</strong>
              <p>Durum değişikliği, atama ve mesaj işlemleri yapıldığında operasyon izi burada zaman sırasıyla listelenir.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
