import { adminApi } from '../../../lib/api';
import { canAssignTickets, canMutateTickets, getAdminSession, isReadOnlyRole } from '../../../lib/session';
import { PendingFieldset, PendingSubmitButton } from '../../components/form-controls';
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
  NEW: 'Yeni kayit',
  TRIAGED: 'On incelemede',
  ASSIGNED: 'Birime atandi',
  IN_PROGRESS: 'Islemde',
  WAITING_INFO: 'Vatandastan bilgi bekleniyor',
  RESOLVED: 'Cozum bildirildi',
  CLOSED: 'Kapatildi',
  REJECTED: 'Reddedildi',
};

const slaCopy: Record<string, string> = {
  OK: 'SLA icinde',
  DUE_SOON: 'SLA yaklasmakta',
  BREACHED: 'SLA asildi',
  UNKNOWN: 'SLA bilinmiyor',
};

const auditActionCopy: Record<string, string> = {
  'ticket.created': 'Talep olusturuldu',
  'ticket.assigned': 'Talep birime atandi',
  'ticket.status_changed': 'Durum degistirildi',
  'ticket.internal_note_added': 'Ic not eklendi',
  'ticket.public_message_added': 'Vatandas mesaji eklendi',
};

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

type FeedbackCopy = { title: string; detail: string };

const successCopy: Record<string, FeedbackCopy> = {
  'status-updated': {
    title: 'Durum guncellendi.',
    detail: 'Kuyruk ve talep detayi yenilendi; varsa vatandas mesaji takip ekraninda gorunur.',
  },
  assigned: {
    title: 'Atama tamamlandi.',
    detail: 'Talep secilen birimin operasyon kuyruguna tasindi.',
  },
  'internal-note-added': {
    title: 'Ic not kaydedildi.',
    detail: 'Bu not yalnizca personel ekranlarinda gorunur; vatandas takip ekranina yansimaz.',
  },
  'public-message-sent': {
    title: 'Vatandas bilgilendirmesi gonderildi.',
    detail: 'Mesaj takip ekranindaki belediye bilgilendirmeleri arasina eklendi.',
  },
};

const errorCopy: Record<string, FeedbackCopy> = {
  session: {
    title: 'Oturum gerekli.',
    detail: 'Isleme devam etmek icin yeniden giris yapin; form verisi guvenlik nedeniyle gonderilmedi.',
  },
  status: {
    title: 'Durum guncellenemedi.',
    detail: 'Secilen gecis bu talep icin uygun olmayabilir veya opsiyonel vatandas mesaji cok kisa olabilir.',
  },
  assignment: {
    title: 'Atama yapilamadi.',
    detail: 'Aktif bir birim secildiginden emin olun; pasif veya eksik birimlere atama yapilmaz.',
  },
  'internal-note': {
    title: 'Ic not kaydedilemedi.',
    detail: 'Not metni bos olmamali; operasyon gecmisi icin kisa ama aciklayici bir kayit girin.',
  },
  'public-message': {
    title: 'Vatandas mesaji gonderilemedi.',
    detail: 'Mesaj metnini kontrol edin; vatandas ekraninda gorunecegi icin acik ve islem odakli yazin.',
  },
  forbidden: {
    title: 'Bu islem rol kapsaminizin disinda.',
    detail: 'Frontend formu role gore daraltiyor; yine de son karar API guard tarafinda. Yetkiniz degistiyse yeniden oturum acin.',
  },
  general: {
    title: 'Islem tamamlanamadi.',
    detail: 'Yetki, baglanti veya kayit durumunu kontrol edip islemi tekrar deneyin.',
  },
};

export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { id } = await params;
  const { success, error } = await searchParams;
  const session = await getAdminSession();
  const token = session?.token ?? null;
  const role = session?.user.role ?? null;
  const ticket = token ? await adminApi.ticket(token, id).catch(() => null) : null;
  const auditLog = token ? await adminApi.auditLog(token, id).catch(() => []) : [];
  const departments = token ? await adminApi.departments(token).catch(() => []) : [];
  const statusOptions = ticket ? [ticket.status, ...(transitions[ticket.status] ?? [])] : [];
  const isTerminal = ticket?.status === 'CLOSED' || ticket?.status === 'REJECTED';
  const canUpdateTicket = Boolean(ticket && !isTerminal && canMutateTickets(role));
  const canAssignTicket = Boolean(ticket && !isTerminal && canAssignTickets(role));
  const readOnlyRole = isReadOnlyRole(role);

  return (
    <main className="main">
      <p className="badge">Talep detayi - {ticket?.ticketNo ?? id}</p>
      <h1>{ticket?.title ?? 'Talep detayi icin giris yapin'}</h1>
      {token && ticket ? (
        <div className="notice muted" role="note">
          <strong>{readOnlyRole ? 'Goruntuleme modu aktif.' : 'Yetki durumu API tarafindan da dogrulanir.'}</strong>
          <p>{readOnlyRole ? 'READ_ONLY rolu icin durum gecisi, atama ve mesaj formlari pasif tutulur.' : canAssignTicket ? 'Atama ve ticket mutasyonlari bu rol icin acik; son karar yine API guard tarafindadir.' : 'Bu rolde ticket guncelleme acik, ancak atama islemi yonetici veya operator rolleriyle sinirlidir.'}</p>
        </div>
      ) : null}
      {success ? (
        <div className="notice success" role="status">
          <strong>{(successCopy[success] ?? { title: 'Islem kaydedildi.', detail: 'Talep detayi guncel verilerle yenilendi.' }).title}</strong>
          <p>{(successCopy[success] ?? { title: 'Islem kaydedildi.', detail: 'Talep detayi guncel verilerle yenilendi.' }).detail}</p>
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
          <p>{ticket ? `${statusCopy[ticket.status] ?? ticket.status} - ${ticket.department?.name ?? 'Atanmamis'} - ${slaCopy[ticket.slaState ?? 'UNKNOWN'] ?? slaCopy.UNKNOWN}` : 'Oturum yok veya API erisilemiyor.'}</p>
          {isTerminal ? (
            <div className="notice muted" role="note">
              <strong>Bu talep son durumda.</strong>
              <p>Kapatilmis veya reddedilmis taleplerde yeni atama, durum gecisi ve mesaj islemleri kabul edilmez.</p>
            </div>
          ) : null}
          {ticket ? (
            <form action={updateStatusAction} style={{ display: 'grid', gap: 10 }}>
              <PendingFieldset style={{ display: 'grid', gap: 10 }}>
                <input type="hidden" name="intent" value="status" />
                <input type="hidden" name="ticketId" value={ticket.id} />
                <select name="status" defaultValue={ticket.status} disabled={!canUpdateTicket}>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{statusCopy[status] ?? status}</option>
                  ))}
                </select>
                <input name="publicMessage" placeholder="Vatandasa opsiyonel durum mesaji" disabled={!canUpdateTicket} />
                <PendingSubmitButton type="submit" disabled={!canUpdateTicket} idleLabel="Durumu guncelle" pendingLabel="Guncelleniyor..." />
              </PendingFieldset>
            </form>
          ) : null}
        </section>
        <section className="card">
          <h2>Atama</h2>
          {ticket ? (
            <form action={assignTicketAction} style={{ display: 'grid', gap: 10 }}>
              <PendingFieldset style={{ display: 'grid', gap: 10 }}>
                <input type="hidden" name="intent" value="assignment" />
                <input type="hidden" name="ticketId" value={ticket.id} />
                <select name="departmentId" defaultValue="" disabled={!canAssignTicket || !departments.length}>
                  <option value="">Birim secin</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
                <PendingSubmitButton type="submit" disabled={!canAssignTicket || !departments.length} idleLabel="Birime ata" pendingLabel="Ataniyor..." />
              </PendingFieldset>
            </form>
          ) : <p style={{ color: 'var(--muted)' }}>Atama icin oturum gerekli.</p>}
        </section>
        <section className="card">
          <h2>Mesajlar</h2>
          {ticket?.messages?.length ? ticket.messages.map((message) => (
            <p key={message.id}><strong>{message.visibility === 'INTERNAL' ? 'Ic not' : 'Vatandas mesaji'}</strong> - {message.body}</p>
          )) : <p style={{ color: 'var(--muted)' }}>Mesaj yok.</p>}
        </section>
        <section className="card">
          <h2>Ic not ekle</h2>
          <form action={addInternalNoteAction} style={{ display: 'grid', gap: 10 }}>
            <PendingFieldset style={{ display: 'grid', gap: 10 }}>
              <input type="hidden" name="intent" value="internal-note" />
              <input type="hidden" name="ticketId" value={ticket?.id ?? id} />
              <textarea name="body" rows={4} placeholder="Sadece personel gorur" disabled={!canUpdateTicket} />
              <PendingSubmitButton type="submit" disabled={!canUpdateTicket} idleLabel="Notu kaydet" pendingLabel="Kaydediliyor..." />
            </PendingFieldset>
          </form>
        </section>
        <section className="card">
          <h2>Vatandas mesaji</h2>
          <form action={addPublicMessageAction} style={{ display: 'grid', gap: 10 }}>
            <PendingFieldset style={{ display: 'grid', gap: 10 }}>
              <input type="hidden" name="intent" value="public-message" />
              <input type="hidden" name="ticketId" value={ticket?.id ?? id} />
              <textarea name="body" rows={4} placeholder="Vatandas takip ekraninda gorunur" disabled={!canUpdateTicket} />
              <PendingSubmitButton type="submit" disabled={!canUpdateTicket} idleLabel="Mesaji gonder" pendingLabel="Gonderiliyor..." />
            </PendingFieldset>
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
              <strong>Henuz audit kaydi gorunmuyor.</strong>
              <p>Durum degisikligi, atama ve mesaj islemleri yapildiginda operasyon izi burada listelenir.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
