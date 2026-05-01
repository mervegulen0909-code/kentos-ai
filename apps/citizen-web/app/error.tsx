'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="wrap">
      <section className="card">
        <p style={{ color: 'var(--muted)', fontWeight: 700 }}>KentOS vatandaş ekranı</p>
        <h1>Sayfa şu an açılamadı.</h1>
        <div className="notice error" role="alert">
          <strong>Teknik ayrıntıları göstermiyoruz.</strong>
          <p>Bilgilerinizi korumak için hata detayı paylaşılmadı. Bağlantınızı kontrol edip tekrar deneyebilirsiniz.</p>
        </div>
        <button className="cta" type="button" onClick={reset}>Tekrar dene</button>
      </section>
    </main>
  );
}
