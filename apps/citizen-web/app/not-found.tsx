export default function NotFound() {
  return (
    <main className="wrap">
      <section className="hero">
        <div className="card" style={{ textAlign: 'center' }}>
          <h1 className="display">404</h1>
          <p style={{ color: 'var(--muted)' }}>
            Aradığınız sayfa bulunamadı veya belediye kaydı mevcut değil.
          </p>
        </div>
      </section>
    </main>
  );
}
