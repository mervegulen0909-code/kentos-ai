'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="main">
      <p className="badge">Operasyon paneli</p>
      <section className="card">
        <h1>Ekran şu an yenilenemedi.</h1>
        <p className="notice error" role="alert">Canlı veri alınırken beklenmeyen bir sorun oluştu. Oturum ve bağlantı durumunu kontrol edip tekrar deneyin.</p>
        <button type="button" onClick={reset}>Tekrar dene</button>
      </section>
    </main>
  );
}
