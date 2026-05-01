export default function Loading() {
  return (
    <main className="wrap">
      <section className="card" aria-busy="true" aria-live="polite">
        <p style={{ color: 'var(--muted)', fontWeight: 700 }}>Başvuru ekranı hazırlanıyor</p>
        <h1>Bilgileri güvenli şekilde yüklüyoruz.</h1>
        <div className="skeleton" />
      </section>
    </main>
  );
}
