import { adminApi } from '../../../lib/api';
import { resolveAdminSession } from '../../../lib/session';
import { AdminShell } from '../../components/admin-shell';
import { anonymizeCitizenAction } from '../actions';

const statusCopy: Record<string, string> = {
  OPEN: 'Açık',
  ASSIGNED: 'Atandı',
  IN_PROGRESS: 'İşlemde',
  PENDING_INFO: 'Bilgi Bekleniyor',
  RESOLVED: 'Çözüldü',
  CLOSED: 'Kapatıldı',
  CANCELLED: 'İptal',
  REOPENED: 'Yeniden Açıldı',
};

const kindCopy: Record<string, string> = {
  PHONE: 'Telefon',
  EMAIL: 'E-posta',
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
};

export default async function CitizenDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await resolveAdminSession();
  const token = session?.accessToken ?? null;
  const role = session?.user.role ?? null;

  const canAnonymize = role === 'SUPER_ADMIN' || role === 'TENANT_ADMIN';

  let citizen = null;
  let dataUnavailable = false;

  if (token) {
    citizen = await adminApi.citizen(token, id).catch(() => {
      dataUnavailable = true;
      return null;
    });
  }

  return (
    <AdminShell hasSession={Boolean(token)} role={role}>
      <div style={{ marginBottom: '1rem' }}>
        <a href="/citizens" style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>← Vatandaş Listesi</a>
      </div>

      <p className="badge">GDPR · Vatandaş Detayı</p>
      <h1>{citizen?.displayName ?? 'Vatandaş Detayı'}</h1>

      {dataUnavailable && <p className="notice error" role="alert">Vatandaş bilgileri alınamadı.</p>}

      {!citizen && !dataUnavailable && (
        <p className="notice">Vatandaş bulunamadı.</p>
      )}

      {citizen && (
        <>
          {/* Summary Card */}
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Kişisel Bilgiler</h2>
            {citizen.isAnonymized && (
              <p className="notice" style={{ background: 'var(--error, #dc2626)', color: '#fff', borderRadius: '4px', padding: '0.5rem 1rem' }}>
                Bu vatandaşın kişisel verileri anonimleştirilmiştir.
              </p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>Ad Soyad</p>
                <strong>{citizen.displayName ?? '—'}</strong>
              </div>
              <div>
                <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>Telefon</p>
                <strong>{citizen.phone ?? '—'}</strong>
              </div>
              <div>
                <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>E-posta</p>
                <strong>{citizen.email ?? '—'}</strong>
              </div>
              <div>
                <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>Kayıt Tarihi</p>
                <strong>{new Date(citizen.createdAt).toLocaleDateString('tr-TR')}</strong>
              </div>
              <div>
                <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>Toplam Talep</p>
                <strong>{citizen.ticketCount}</strong>
              </div>
            </div>

            {canAnonymize && !citizen.isAnonymized && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <form action={async (_fd: FormData) => { await anonymizeCitizenAction(citizen.id); }}>
                  <button
                    type="submit"
                    style={{ background: 'var(--error, #dc2626)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer' }}
                    onClick={(e) => { if (!confirm('Bu vatandaşın kişisel verileri kalıcı olarak silinecek. Bu işlem geri alınamaz. Onaylıyor musunuz?')) e.preventDefault(); }}
                  >
                    Kişisel Verileri Anonimleştir (GDPR)
                  </button>
                  <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                    Bu işlem vatandaşın adı, telefonu ve e-postasını kalıcı olarak siler. Talepler korunur.
                  </p>
                </form>
              </div>
            )}
          </section>

          {/* Identifiers */}
          {citizen.identifiers && citizen.identifiers.length > 0 && (
            <section className="card">
              <h2 style={{ marginTop: 0 }}>İletişim Kimlikleri</h2>
              <div className="ticket-list">
                {citizen.identifiers.map((ident, i) => (
                  <div key={i} className="ticket-list-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span className="badge">{kindCopy[ident.kind] ?? ident.kind}</span>
                      <span style={{ marginLeft: '0.75rem' }}>{ident.normalizedValue}</span>
                    </div>
                    {ident.isPrimary && <span className="badge" style={{ background: 'var(--primary, #2563eb)', color: '#fff' }}>Birincil</span>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tickets */}
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Talepler ({citizen.tickets?.length ?? 0})</h2>
            {citizen.tickets && citizen.tickets.length > 0 ? (
              <div className="ticket-list">
                {citizen.tickets.map((ticket) => (
                  <div key={ticket.id} className="ticket-list-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <a href={`/tickets/${ticket.id}`} style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                        #{ticket.ticketNo}
                      </a>
                      <span style={{ marginLeft: '0.75rem', color: 'var(--muted)' }}>{ticket.title}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span className="badge">{statusCopy[ticket.status] ?? ticket.status}</span>
                      <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                        {new Date(ticket.createdAt).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <strong>Kayıtlı talep bulunamadı.</strong>
              </div>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
