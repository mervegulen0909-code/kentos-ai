import { adminApi, formatMissingFieldLabel } from '../../../lib/api';
import { canAssignTickets, canMutateTickets, isReadOnlyRole, resolveAdminSession } from '../../../lib/session';
import { AdminShell } from '../../components/admin-shell';
import { PendingFieldset, PendingSubmitButton } from '../../components/form-controls';
import { addInternalNoteAction, addPublicMessageAction, assignTicketAction, updateStatusAction } from '../actions';

const transitions: Record<string, string[]> = {
  NEW: ['TRIAGED', 'ASSIGNED', 'REJECTED'],
  TRIAGED: ['ASSIGNED', 'WAITING_INFO', 'REJECTED'],
  ASSIGNED: ['IN_PROGRESS', 'WAITING_INFO', 'REJECTED'],
  IN_PROGRESS: ['WAITING_INFO', 'RESOLVED', 'REJECTED'],
  WAITING_INFO: ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'],
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

const confidenceFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'percent',
  maximumFractionDigits: 0,
});

type FeedbackCopy = { title: string; detail: string };

const quickStatusActions = [
  { action: updateStatusAction, intent: 'status', status: 'WAITING_INFO', label: 'Bilgi iste', pendingLabel: 'Isteniyor...', placeholder: 'Vatandastan istenen bilgiyi kisaca yazin' },
  { action: updateStatusAction, intent: 'status', status: 'RESOLVED', label: 'Cozum bildir', pendingLabel: 'Bildiriliyor...', placeholder: 'Vatandasa gidecek cozum mesajini yazin' },
  { action: updateStatusAction, intent: 'status', status: 'REJECTED', label: 'Reddet', pendingLabel: 'Reddediliyor...', placeholder: 'Reddetme gerekcesini vatandas dilinde yazin' },
];

const successCopy: Record<string, FeedbackCopy> = {
  'status-updated': {
    title: 'Durum guncellendi.',
    detail: 'Kuyruk ve talep detayi yenilendi; varsa vatandas mesaji takip ekraninda gorunur.',
  },
  assigned: {
    title: 'Atama tamamlandi.',
    detail: 'Talep secilen birimin operasyon kuyruguna tasindi.',
  },
  'created-from-handoff': {
    title: 'Operator devrinden ticket olusturuldu.',
    detail: 'Konusma kaydi ticket omurgasina alindi; bundan sonraki operasyon akisi standart talep ekranindan ilerler.',
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
  searchParams: Promise<{ success?: string; error?: string; errorMessage?: string }>;
}) {
  const { id } = await params;
  const { success, error, errorMessage } = await searchParams;
  const session = await resolveAdminSession();
  const token = session?.accessToken ?? null;
  const hasSession = Boolean(token);
  const role = session?.user.role ?? null;
  const ticket = token ? await adminApi.ticket(token, id).catch(() => null) : null;
  const auditLog = token ? await adminApi.auditLog(token, id).catch(() => []) : [];
  const departments = token ? await adminApi.departments(token).catch(() => []) : [];
  const statusOptions = ticket ? [ticket.status, ...(transitions[ticket.status] ?? [])] : [];
  const isTerminal = ticket?.status === 'CLOSED' || ticket?.status === 'REJECTED';
  const canUpdateTicket = Boolean(ticket && !isTerminal && canMutateTickets(role));
  const canAssignTicket = Boolean(ticket && !isTerminal && canAssignTickets(role));
  const readOnlyRole = isReadOnlyRole(role);
  const aiSummary = ticket?.aiSummary ?? null;
  const aiClassification = aiSummary?.classification ?? null;

  return (
    <AdminShell hasSession={hasSession} role={role}>
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
          <p>{errorMessage ?? (errorCopy[error] ?? errorCopy.general).detail}</p>
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
          ) : <p style={{ color: 'var(--muted)' }}>{hasSession ? 'Talep verisi alinamadi; erisim veya API durumu kontrol edilmeli.' : 'Atama icin oturum gerekli.'}</p>}
        </section>
        <section className="card">
          <h2>AI intake ozeti</h2>
          {aiClassification ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <p><strong>Niyet:</strong> {aiClassification.intent}</p>
              <p><strong>Oncelik:</strong> {aiClassification.priority}</p>
              <p><strong>Guven:</strong> {aiSummary?.confidence != null ? confidenceFormatter.format(aiSummary.confidence) : 'Bilinmiyor'}</p>
              <p><strong>Onerilen kategori:</strong> {aiClassification.categoryCode ?? 'Yok'}</p>
              <p><strong>Onerilen birim:</strong> {aiClassification.departmentCode ?? 'Yok'}</p>
              <p><strong>Adres/cozumleme:</strong> {aiClassification.addressText ?? 'Yok'}</p>
              <p><strong>Takip no sorgusu:</strong> {aiClassification.statusTicketNo ?? 'Yok'}</p>
              <p><strong>Iletisim sinyali:</strong> {aiSummary?.contactSignals ? `${aiSummary.contactSignals.hasPhone ? 'Telefon var' : 'Telefon yok'} - ${aiSummary.contactSignals.hasEmail ? 'E-posta var' : 'E-posta yok'}${aiSummary.contactSignals.displayName ? ` - ${aiSummary.contactSignals.displayName}` : ''}` : 'Audit sinyali yok'}</p>
              <p><strong>Eksik alanlar:</strong> {aiClassification.missingFields.length ? aiClassification.missingFields.map((field) => formatMissingFieldLabel(field)).join(', ') : 'Yok'}</p>
              <p><strong>Takip sorusu:</strong> {aiClassification.followUpQuestion ?? 'Gerekmedi'}</p>
              <p><strong>Ozet:</strong> {aiClassification.reasoningSummary}</p>
            </div>
          ) : (
            <p style={{ color: 'var(--muted)' }}>Bu talep icin AI intake ozeti bulunmuyor.</p>
          )}
        </section>
        <section className="card">
          <h2>Mesajlar</h2>
          {ticket?.messages?.length ? ticket.messages.map((message) => (
            <p key={message.id}><strong>{message.visibility === 'INTERNAL' ? 'Ic not' : 'Vatandas mesaji'}</strong> - {message.body}</p>
          )) : <p style={{ color: 'var(--muted)' }}>Mesaj yok.</p>}
        </section>
        <section className="card">
          <h2>Hizli aksiyonlar</h2>
          {ticket ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {quickStatusActions.map((quickAction) => (
                <form key={quickAction.status} action={quickAction.action} style={{ display: 'grid', gap: 10 }}>
                  <PendingFieldset style={{ display: 'grid', gap: 10 }}>
                    <input type="hidden" name="intent" value={quickAction.intent} />
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <input type="hidden" name="status" value={quickAction.status} />
                    <textarea name="publicMessage" rows={3} placeholder={quickAction.placeholder} disabled={!canUpdateTicket} />
                    <PendingSubmitButton type="submit" disabled={!canUpdateTicket || !statusOptions.includes(quickAction.status)} idleLabel={quickAction.label} pendingLabel={quickAction.pendingLabel} />
                  </PendingFieldset>
                </form>
              ))}
            </div>
          ) : <p style={{ color: 'var(--muted)' }}>{hasSession ? 'Hizli aksiyonlar icin talep detayi yuklenemedi.' : 'Hizli aksiyonlar icin oturum gerekli.'}</p>}
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
    </AdminShell>
  );
}
