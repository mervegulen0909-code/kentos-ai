export default function CitizenHome() {
  return (
    <main className="wrap">
      <section className="hero">
        <div>
          <p style={{ color: 'var(--muted)', fontWeight: 700 }}>Demo Belediyesi · KentOS AI</p>
          <h1 className="display">Talebini açıkça yaz, süreci takip et.</h1>
          <p style={{ color: 'var(--muted)', fontSize: '1.25rem', maxWidth: 620 }}>
            Yol, temizlik, park, zabıta, su-kanalizasyon ve diğer belediye taleplerini konum ve fotoğrafla ilet. Başvuru numaranla durumunu izleyebilirsin.
          </p>
        </div>
        <form className="card">
          <div className="field">
            <label htmlFor="description">Talebiniz</label>
            <textarea id="description" rows={5} placeholder="Örn. Atatürk Mahallesi 12. Sokak'ta kaldırım çöktü." />
          </div>
          <div className="field">
            <label htmlFor="address">Adres veya konum tarifi</label>
            <input id="address" placeholder="Mahalle, sokak, bina önü..." />
          </div>
          <div className="field">
            <label htmlFor="phone">Telefon</label>
            <input id="phone" type="tel" placeholder="Durum bilgilendirmesi için" autoComplete="tel" />
          </div>
          <button className="cta" type="button">Başvuruyu Hazırla</button>
          <p style={{ color: 'var(--muted)' }}>AI eksik bilgi varsa önce size kısa bir takip sorusu sorar; uygun talep birime ve SLA sürecine aktarılır.</p>
        </form>
      </section>
    </main>
  );
}
