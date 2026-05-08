import Link from 'next/link';

const quickPrompts = [
  'Sokak lambası üç gündür yanmıyor.',
  'Çöp konteyneri taşıyor, ekip yönlendirilsin.',
  'Park içindeki sulama hattı patlamış olabilir.',
];

const metrics = [
  ['24/7', 'Vatandaş mesajı web, widget ve WhatsApp kanallarından alınır.'],
  ['TK', 'Halka açık takip sadece güvenli takip koduyla yapılır.'],
  ['SLA', 'Departman, kategori ve süre hedefleri operasyon panelinde izlenir.'],
];

export default function CitizenHome() {
  return (
    <main className="wrap home-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Demo Belediyesi · KentOS AI</p>
          <h1 className="display">Belediye asistanı; talebi alır, kayda çevirir, süreci görünür kılar.</h1>
          <p className="lede">
            Vatandaş tek cümleyle başlar. Sistem konuyu yapılandırır, eksik bilgi varsa tamamlatır ve resmi başvuru omurgasına güvenli takip koduyla taşır.
          </p>
          <div className="action-row">
            <Link className="cta" href="/demo-belediye/report">Başvuru oluştur</Link>
            <Link className="secondary-cta" href="/demo-belediye/track">Takip kodu gir</Link>
            <Link className="secondary-cta" href="/widget/demo-belediye">Widget önizle</Link>
          </div>
          <div className="home-metrics" aria-label="KentOS yetenekleri">
            {metrics.map(([value, label]) => (
              <div className="metric-card" key={value}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <section className="card assistant-preview-panel" aria-label="Belediye asistanı önizlemesi">
          <p className="eyebrow">Web asistanı önizleme akışı</p>
          <h2 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>
            Gömülebilir, takip kodlu, belediye tonunda.
          </h2>
          <p className="panel-muted" style={{ lineHeight: 1.55, marginTop: 14 }}>
            Bu deneyim belediye sitesine tek script ile eklenir; mesajlar WEB_CHAT kanalıyla aynı ticket, SLA ve audit omurgasına bağlanır.
          </p>
          <div className="preview-thread">
            <div className="preview-bubble preview-bubble-assistant">
              Merhaba. Talebinizi tek cümleyle yazın; eksik bilgi varsa size kısa bir takip sorusu sorayım.
            </div>
            {quickPrompts.map((prompt) => (
              <div className="preview-bubble preview-bubble-user" key={prompt}>{prompt}</div>
            ))}
            <div className="notice preview-note">
              <strong>Operasyon köprüsü hazır.</strong>
              <p>Widget, vatandaş formu ve WhatsApp aynı kanal analitiğinde birleşir.</p>
            </div>
          </div>

          <form action="/demo-belediye/report" method="get" style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            <input type="hidden" name="source" value="assistant-preview" />
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="assistant-preview-message">Vatandaşın ilk mesajı</label>
              <textarea
                id="assistant-preview-message"
                name="draft"
                rows={4}
                placeholder="Örn. 7. Cadde köşesinde mazgal taşmış, yol su içinde kaldı."
                defaultValue="Atatürk Mahallesi 12. Sokak'ta kaldırım çöktü, bebek arabası geçemiyor."
              />
            </div>
            <div className="action-row" style={{ marginTop: 0 }}>
              <button className="cta" type="submit">Mesajı başvuruya taşı</button>
              <Link className="secondary-cta" href="/widget/demo-belediye">Widget kabuğunu aç</Link>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
