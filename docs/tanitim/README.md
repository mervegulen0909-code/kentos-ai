# KentOS AI — Tanıtım Videosu / Slider Storyboard'u

> Bu klasör, müşteri tanıtım videosu ve slider'ı için sahne sırası + anlatım metnidir.
> Ekran görüntüleri canlı ortamdan (`vatandas.izmirusulü.com`, `admin.izmirusulü.com`) alınmıştır.
> Akış, `SATIS_VE_TANITIM_PLANI.md` Bölüm 7'deki 15 dakikalık demo senaryosuna dayanır.
> Bölüm bazlı PNG'ler: `docs/tanitim/screenshots/<bolum>/`. Maskot detayı: [MASKOT.md](MASKOT.md). Test bulguları: [BULGULAR.md](BULGULAR.md).

---

## Açılış (0:00–0:15)
**Görsel:** Vatandaş başvuru sayfası + sağ-altta yüzen **AI maskotu** ("Size nasıl yardımcı olabilirim?").
**Anlatım:** "KentOS AI — vatandaşın tek cümleyle başlattığı talebi yapay zeka ile doğru birime yönlendiren, 11 kanalı tek ticket omurgasında birleştiren belediye asistanı platformu."

## Sahne 1 — Vatandaş Deneyimi (0:15–1:30)
**Görsel:** `01-vatandas` başvuru formu → açıklama yazımı → takip kodu (TK-…) ekranı.
**Anlatım:** "Vatandaş 15 saniyede başvurusunu yapar; telefon beklemez, dilekçe yazmaz. Sistem güvenli TK takip koduyla talebi oluşturur."

## Sahne 2 — Konuşan AI Maskotu (1:30–3:00) ⭐ YENİ
**Görsel:** `09-maskot` — maskot açık, vatandaş "Çöp ne zaman toplanıyor?" yazıyor → **gerçek AI yanıtı**; ardından şikâyet → çok-turlu → **TK takip kodu**.
**Anlatım:** "Maskot gerçek yapay zekayla (OpenAI gpt-4o) karşılıklı konuşur: soruları yanıtlar, bilmediğinde doğru birime yönlendirir, talebi oluşturup takip kodu verir. Belediyenin SSS ve hazır yanıtlarıyla beslenir — kullandıkça gelişir."

## Sahne 3 — AI Sınıflandırma (Admin) (3:00–4:30)
**Görsel:** `11-tickets` talep detayı — **AI intake özeti** (niyet: new_ticket, öncelik, güven %).
**Anlatım:** "Yapay zeka talebi otomatik sınıflandırıp birime yönlendirir; operatör yalnızca onaylar."

## Sahne 4 — Operatör Akışı (4:30–6:00)
**Görsel:** Talep detayı — durum güncelleme (Yeni → Atandı → Çözülüyor), atama, hazır yanıt.
**Anlatım:** "Operatör tek ekranda durumu günceller, birime atar, hazır yanıtla vatandaşa döner."

## Sahne 5 — Çok Kanal & Widget (6:00–7:30)
**Görsel:** `21-settings` — tek satır widget kurulum kodu (`<script src=…/widget.js>`).
**Anlatım:** "Belediye sitenize tek satır kod ekleyin, 5 dakikada canlı. WhatsApp, web, e-posta, SMS, Telegram, Instagram, Facebook — hepsi aynı ticket'a düşer."

## Sahne 6 — Yönetim & SLA & Raporlar (7:30–9:30)
**Görsel:** `10-dashboard` KPI kartları + `14-reports` (açık yük, SLA alarmı, **AI kullanım & maliyet**), `13-queues` birim kuyrukları.
**Anlatım:** "Açık kuyruk, SLA ihlalleri, AI otomasyon oranı ve maliyet — yöneticiye tek bakışta."

## Sahne 7 — Güvenlik & KVKK (9:30–11:00)
**Görsel:** `15-citizens` — vatandaş anonimleştirme (KVKK), denetim izi, veri saklama ayarları.
**Anlatım:** "Tüm KVKK gereksinimleri yerleşik: anonimleştirme, veri silme, denetim izi — ayrı modül/ücret yok."

## Kapanış (11:00–12:00)
**Anlatım:** "30 günlük ücretsiz pilot — gerçek departmanlarınız, gerçek vatandaşlarınız. Widget'ı ekleyelim, WhatsApp hattınızı bağlayalım, 1 hafta içinde canlı."

---

## Ekran görüntüsü envanteri (alınanlar)
| # | Bölüm | İçerik |
|---|---|---|
| 01 | Vatandaş · Başvuru | Form + harita + maskot launcher |
| 03 | Vatandaş · Takip | Takip kodu sorgu |
| 05 | Vatandaş · SSS | Bilgi bankası (seed sonrası dolu) |
| 06 | Vatandaş · Randevu | E-randevu |
| 07 | Vatandaş · Hesap/KVKK | Giriş guard'ı |
| 09 | **Maskot** | Açık sohbet + gerçek AI yanıtı + TK kodu |
| 10 | Admin · Dashboard | KPI kartları |
| 11 | Admin · Talepler + detay | Liste + **AI intake özeti** |
| 14 | Admin · Raporlar | Operasyon + AI kullanım/maliyet |
| 15 | Admin · Vatandaşlar | KVKK anonimleştirme |
| 21 | Admin · Ayarlar | Tek satır widget kurulum kodu |

> Not: Maskot ve tüm client etkileşimi canlıda **CSP düzeltmesi deploy edilince** tam çalışır (bkz. BULGULAR.md). Backend (maskot AI) zaten canlıda çalışıyor.

---

## Canlı Yakalama Sonuçları (29 Mayıs 2026)

Canlı ortamda (`vatandas.izmirusulü.com` / `admin.izmirusulü.com`) uçtan uca, gerçek
kullanıcı/operatör gibi gezildi. Hydration + maskot UI **canlıda çalışıyor** (CSP
düzeltmesi deploy edildi); SSS dolu, randevu slotları mevcut.

**Video sahne sırası → önerilen dosya adı → durum.** Ekran görüntüleri sohbete
iliştirildi; her birini `docs/tanitim/screenshots/<bölüm>/` altına aşağıdaki adla
kaydedin (NN = video sırası).

| # | Sahne | Önerilen dosya | Durum |
|---|---|---|---|
| 00 | Açılış: başvuru sayfası + maskot launcher | `00-acilis-basvuru-maskot.png` | ✅ |
| 01a | Başvuru formu (dolu) | `01-basvuru-form-dolu.png` | ✅ |
| 01b | Başvuru başarılı → **TK kodu + AI sınıflandırma** (Fen İşleri / Acil / SLA) | `01-basvuru-basari-tk-ai.png` | ✅ ⭐ |
| 02a | Maskot AI yanıtı — "Çöp ne zaman toplanıyor?" | `02-maskot-ai-yanit-cop.png` | ✅ ⭐ |
| 02b | Maskot AI yanıtı — sokak lambası | `02-maskot-ai-yanit-lamba.png` | ✅ |
| 02c | Maskot sohbetten **TK kodu** verir | `02-maskot-tk-kodu.png` | ⏳ `fix/maskot-ticket` deploy bekliyor |
| 03 | Takip: TK ile sorgu → durum + vatandaş zaman çizelgesi | `03-takip-detay.png` | ✅ |
| 05 | SSS — çok dilli (TR/EN/Kurdî/AR), 12 makale | `05-faq-cokdilli.png` | ✅ |
| 06 | E-Randevu — müsait slotlar | `06-randevu-slotlar.png` | ✅ |
| 07 | Hesap — KVKK giriş guard'ı | `07-account-kvkk-guard.png` | ✅ |
| 10 | Admin Dashboard — KPI + öncelikli kuyruk | `10-admin-dashboard.png` | ✅ |
| 11a | Admin Talepler listesi + filtreler | `11-admin-talepler-liste.png` | ✅ |
| 11b | Talep detayı — **AI intake özeti** (URGENT, güven %95, YOL_KALDIRIM) | `11-admin-talep-detay-ai.png` | ✅ ⭐ |
| 12 | Operatör devri — çok kanallı (Facebook DM, WhatsApp) | `12-admin-operator-devri.png` | ✅ |
| 13 | Birim kuyrukları — departman SLA yoğunluğu | `13-admin-birim-kuyruklari.png` | ✅ |
| 14 | Raporlar — **AI kullanım & maliyet** (openai, %100, $0.0661) | `14-admin-raporlar-ai-maliyet.png` | ✅ ⭐ |
| 15 | Vatandaşlar — KVKK anonimleştirme | `15-admin-vatandaslar-kvkk.png` | ✅ |
| 18 | Bilgi Bankası — çok dilli FAQ yönetimi (maskotu besler) | `18-admin-bilgi-bankasi.png` | ✅ |
| 21 | Ayarlar — **tek satır widget kurulum kodu** | `21-admin-ayarlar-widget.png` | ✅ ⭐ |

> ⭐ = vurgu sahneleri. `02c` (maskot TK) için `fix/maskot-ticket` PR'ı merge + deploy
> edildikten sonra `/demo-belediye/report` → maskot → net şikâyet ile yeniden çekilmeli.

### Canlı kanıt (öne çıkanlar)
- **Başvuru → AI:** "Cumhuriyet Mah. ...kaldırım çöktü... acil" → **TK-0FCD1B0FC9D2AED5**,
  birim **Fen İşleri**, kategori **Yol/kaldırım/asfalt**, öncelik **Acil**, SLA otomatik.
- **Maskot Q&A:** "Çöp ne zaman toplanıyor?" → grounded, gün uydurmadan, talep önerisiyle.
- **Raporlar:** sağlayıcı **openai**, %100 başarı; otomasyon oranı %27.3.

> Dosya teslimi: MCP tarayıcısı yerel dosya sistemine yazamadığından görüntüler repoya
> otomatik commit edilemedi; sohbete iliştirilen görselleri yukarıdaki adlarla ilgili
> klasörlere bırakın.
