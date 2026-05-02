export default function ReportsLoading() {
  return (
    <main className="main">
      <p className="badge">Operasyon raporları yükleniyor</p>
      <h1>Günlük belediye operasyon raporu hazırlanıyor.</h1>
      <section className="grid" aria-busy="true" aria-live="polite">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </section>
    </main>
  );
}
