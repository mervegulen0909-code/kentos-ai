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

const successCopy: Record<string, string> = {
  'status-updated': 'Durum güncellendi; kuyruk ve talep detayı yenilendi.',
  assigned: 'Talep seçilen birime atandı.',
  'internal-note-added': 'İç not kaydedildi; vatandaş ekranında görünmez.',
  'public-message-sent': 'Vatandaş bilgilendirmesi gönderildi ve takip ekranına eklendi.',
};

const errorCopy: Record<string, string> = {
  session: 'Oturum bulunamadı. İşlem yapmak için yeniden giriş yapın.',
  status: 'Durum güncellenemedi. Geçiş kuralı veya mesaj alanını kontrol edin.',
  assignment: 'Atama yapılamadı. Geçerli ve aktif bir birim seçin.',
  'internal-note': 'İç not kaydedilemedi. Not metni boş olmamalı.',
  'public-message': 'Vatandaş mesajı gönderilemedi. Metni kontrol edip tekrar deneyin.',
  general: 'İşlem tamamlanamadı. Yetki, bağlantı veya kayıt durumunu kontrol edin.',
};

export default async function TicketDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const { id } = await params;
  const { success, error } = await searchParams;
  const token = await getSessionToken();
  const ticket = token ? await adminApi.ticket(token, id).catch(() => null) : null;
  const auditLog = token ? await adminApi.auditLog(token, id).catch(() => []) : [];
  const departments = token ? await adminApi.departments(token).catch(() => []) : [];
  const statusOptions = ticket ? [ticket.status, ...(transitions[ticket.status] ?? [])] : [];

  return (
    <main className="main">
      <p className="badge">Talep detayı · {ticket?.ticketNo ?? id}</p>
      <h1>{ticket?.title ?? 'Talep detayı için giriş yapın'}</h1>
      {success ? <p className="notice success" role="status">{successCopy[success] ?? 'İşlem kaydedildi.'}</p> : null}
      {error ? <p className="notice error" role="alert">{errorCopy[error] ?? errorCopy.general}</p> : null}
      <div className="grid">
        <section className="card">
          <h2>Durum</h2>
          <p>{ticket ? `${ticket.status} · ${ticket.department?.name ?? 'Atanmamış'} · ${ticket.slaState ?? 'UNKNOWN'}` : 'Oturum yok veya API erişilemiyor.'}</p>
          {ticket ? (
            <form action={updateStatusAction} style={{ display: 'grid', gap: 10 }}>
              <input type="hidden" name="intent" value="status" />
              <input type="hidden" name="ticketId" value={ticket.id} />
              <select name="status" defaultValue={ticket.status}>
                {statusOptions.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
              <input name="publicMessage" placeholder="Vatandaşa opsiyonel durum mesajı" />
              <button type="submit">Durumu güncelle</button>
            </form>
          ) : null}
        </section>
        <section className="card">
          <h2>Atama</h2>
          {ticket ? (
            <form action={assignTicketAction} style={{ display: 'grid', gap: 10 }}>
              <input type="hidden" name="intent" value="assignment" />
              <input type="hidden" name="ticketId" value={ticket.id} />
              <select name="departmentId" defaultValue="">
                <option value="">Birim seçin</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
              <button type="submit" disabled={!departments.length}>Birime ata</button>
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
            <textarea name="body" rows={4} placeholder="Sadece personel görür" />
            <button type="submit" disabled={!ticket}>Notu kaydet</button>
          </form>
        </section>
        <section className="card">
          <h2>Vatandaş mesajı</h2>
          <form action={addPublicMessageAction} style={{ display: 'grid', gap: 10 }}>
            <input type="hidden" name="intent" value="public-message" />
            <input type="hidden" name="ticketId" value={ticket?.id ?? id} />
            <textarea name="body" rows={4} placeholder="Vatandaş takip ekranında görünür" />
            <button type="submit" disabled={!ticket}>Mesajı gönder</button>
          </form>
        </section>
        <section className="card">
          <h2>Audit timeline</h2>
          {auditLog.length ? auditLog.map((item) => (
            <p key={item.id}><strong>{item.action}</strong> · {new Date(item.createdAt).toLocaleString('tr-TR')}</p>
          )) : <p style={{ color: 'var(--muted)' }}>Audit kaydı yok veya oturum açılmadı.</p>}
        </section>
      </div>
    </main>
  );
}
