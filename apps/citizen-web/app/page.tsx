import Link from 'next/link';

const quickPrompts = [
  'Sokak lambası üç gündür yanmıyor.',
  'Çöp konteyneri taşıyor, ekip yönlendirilsin.',
  'Park içindeki sulama hattı patlamış olabilir.',
];

export default function CitizenHome() {
  return (
    <main className="wrap">
      <section className="hero">
        <div>
          <p style={{ color: 'var(--muted)', fontWeight: 700 }}>Demo Belediyesi · KentOS AI</p>
          <h1 className="display">Belediye asistanı ile yazış, başvuru aç, süreci takip et.</h1>
          <p style={{ color: 'var(--muted)', fontSize: '1.25rem', maxWidth: 680 }}>
            Bu yüz, ayrı bir vatandaş uygulaması ile belediye sitesine gömülebilecek asistan deneyimi arasındaki ilk köprüdür.
            Vatandaş hızlıca talep başlatır, sonra resmi başvuru akışına ya da takip ekranına geçer.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
            <Link className="cta" href="/demo-belediye/report" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
              Başvuru oluştur
            </Link>
            <Link
              href="/demo-belediye/track"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 48,
                padding: '0 22px',
                borderRadius: 999,
                border: '1px solid var(--line)',
                color: 'var(--ink)',
                background: 'var(--surface)',
                textDecoration: 'none',
              }}
            >
              Takip kodu gir
            </Link>
          </div>
        </div>

        <section className="card" aria-label="Belediye asistanı önizlemesi">
          <p style={{ margin: 0, color: 'var(--muted)', fontWeight: 700 }}>Web asistanı önizleme akışı</p>
          <div
            style={{
              marginTop: 18,
              display: 'grid',
              gap: 12,
              border: '1px solid var(--line)',
              borderRadius: 20,
              padding: 18,
              background: 'oklch(98% 0.01 92)',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                justifySelf: 'start',
                background: 'white',
                border: '1px solid var(--line)',
                borderRadius: 18,
                padding: '12px 14px',
              }}
            >
              Merhaba. Talebinizi tek cümleyle yazın; eksik bilgi varsa size kısa bir takip sorusu sorayım.
            </div>
            {quickPrompts.map((prompt) => (
              <div
                key={prompt}
                style={{
                  maxWidth: '88%',
                  justifySelf: 'end',
                  background: 'var(--ink)',
                  color: 'white',
                  borderRadius: 18,
                  padding: '12px 14px',
                }}
              >
                {prompt}
              </div>
            ))}
            <div className="notice" style={{ marginBottom: 0 }}>
              Bu ilk dalgada gerçek sohbet motoru yerine yönlendirilmiş bir giriş yüzü sunuyoruz. Sonraki fazda çok adımlı konuşma akışı eklenecek.
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
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              Üretim kullanımında bu alan widget konuşmasına dönüşecek. Şimdilik ilk mesajı resmi başvuru formuna taşıyoruz.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="cta" type="submit">Mesajı başvuruya taşı</button>
              <Link
                href="/widget/demo-belediye"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 48,
                  padding: '0 22px',
                  borderRadius: 999,
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                  background: 'var(--surface)',
                  textDecoration: 'none',
                }}
              >
                Widget kabuğunu aç
              </Link>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
