import { trackTicketAction } from './actions';

export default async function TrackPage({ params, searchParams }: { params: Promise<{ tenantSlug: string }>; searchParams: Promise<{ error?: string }> }) {
  const { tenantSlug } = await params;
  const { error } = await searchParams;
  const action = trackTicketAction.bind(null, tenantSlug);

  return (
    <main className="wrap">
      <form action={action} className="card" style={{ maxWidth: 720 }}>
        <p style={{ color: 'var(--muted)', fontWeight: 700 }}>{tenantSlug} · Başvuru takibi</p>
        <h1>Başvuru numaranızı girin.</h1>
        {error ? <p role="alert" style={{ color: 'oklch(54% 0.2 28)' }}>Başvuru numarası gerekli.</p> : null}
        <div className="field">
          <label htmlFor="ticketNo">Başvuru numarası</label>
          <input id="ticketNo" name="ticketNo" placeholder="KNT-2026-000123" required />
        </div>
        <button className="cta" type="submit">Durumu sorgula</button>
      </form>
    </main>
  );
}
