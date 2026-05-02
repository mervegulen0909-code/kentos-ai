export default function QueuesLoading() {
  return (
    <main className="main">
      <p className="badge">Birim kuyrukları yükleniyor</p>
      <h1>SLA ve iş yükü görünümü hazırlanıyor.</h1>
      <section className="card" aria-busy="true" aria-live="polite" style={{ display: 'grid', gap: 12 }}>
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </section>
    </main>
  );
}
