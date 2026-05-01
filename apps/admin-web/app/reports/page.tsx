export default function ReportsPage() {
  return (
    <main className="main">
      <p className="badge">AI yönetici özeti</p>
      <h1>Günlük operasyon raporu</h1>
      <section className="card">
        <h2>Öne çıkanlar</h2>
        <ul>
          <li>Fen İşleri taleplerinde kaldırım ve yol arızası yoğunluğu arttı.</li>
          <li>Temizlik taleplerinde üç mahallede konteyner taşması tekrar ediyor.</li>
          <li>17 talep SLA ihlali riski taşıyor.</li>
        </ul>
      </section>
    </main>
  );
}
