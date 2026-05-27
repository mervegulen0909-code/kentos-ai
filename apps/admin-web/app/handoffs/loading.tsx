export default function Loading() {
  return (
    <main className="main">
      <p className="badge">Devir işlemleri yükleniyor</p>
      <h1>Devir listesi hazırlanıyor.</h1>
      <section className="card" style={{ display: 'grid', gap: 12 }} aria-busy="true" aria-live="polite">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </section>
    </main>
  );
}
