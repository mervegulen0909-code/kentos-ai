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
