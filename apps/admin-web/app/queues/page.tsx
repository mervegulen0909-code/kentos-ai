export default function QueuesPage() {
  return (
    <main className="main">
      <p className="badge">Birim kuyrukları</p>
      <h1>Departman iş yükü</h1>
      <div className="grid">
        {['Fen İşleri', 'Temizlik İşleri', 'Zabıta', 'Park ve Bahçeler'].map((department, index) => (
          <section className="card" key={department}>
            <h2>{department}</h2>
            <p className="kpi">{[42, 31, 18, 12][index]}</p>
            <p style={{ color: 'var(--muted)' }}>Açık talep</p>
          </section>
        ))}
      </div>
    </main>
  );
}
