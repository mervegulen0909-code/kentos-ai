# KentOS AI — Video Senaryosu & AI Video Üretim Promptları

> Bu doküman PDF tanıtımının (`KentOS-AI-Tanitim.pdf`) konularına göre kurgulanmış,
> uçtan uca tanıtım filmi senaryosudur. Her sahne için: **anlatım (TR)**, **ekran metni (TR)**,
> **AI video prompt (EN — Sora / Veo 3 / Kling / Runway için optimize)** ve **kompozit edilecek
> gerçek arayüz** ayrı ayrı verilmiştir.
>
> **Hedef araç: Sora / Veo 3 · Ana format: 16:9.** Prompt'lar bu araçlara ve yatay sinematik
> dile göre optimize edildi. Veo 3 **yerel ses** ürettiği için her sahnede ayrı **Ses (Veo 3)** cue'su var.
>
> **Önemli yöntem:** AI video araçları uygulama arayüzü/Türkçe metni düzgün üretemez. Bu yüzden
> akış **hibrit**tir: AI **sinematik B-roll** üretir (vatandaş, şehir, ofis, his); **gerçek ürün
> ekranları** `docs/tanitim/screenshots/` + PDF'ten alınıp post-prodüksiyonda B-roll üstüne
> bindirilir. Türkçe metin/anlatım sonradan eklenir (mevcut `tools/build-video-cards.ts` kart sistemi).

---

## Marka Çerçevesi (her prompt'a uygula)

- **Ana renk:** belediye mavisi `#0E5FD9`, vurgu açık mavi `#3b9eff`, koyu antrasit `#0f172a`, temiz beyaz.
- **Maskot KENT:** yuvarlak hatlı, dost canlısı robot; belediye mavisi + beyaz gövde, başında hafif anten (bildirim ışığı). Sıcak ama profesyonel. **Not:** gerçek uygulamadaki maskot 2D SVG ve demo-belediye temasında yeşil/teal; marka filmi için **mavi (#0E5FD9)** sürümü kullan — kompozit ettiğin gerçek yeşil ekranlarla küçük renk farkı "tenant'a özel tema" olarak doğaldır (istersen yakalamadan önce demo temasını maviye çek).
- **Ton:** güven veren, modern, sıcak, kamu hizmeti ciddiyeti + teknoloji ferahlığı. Asla soğuk/bürokratik değil.
- **Görsel dil:** doğal gün ışığı, sığ alan derinliği, yumuşak gölgeler, akıcı yavaş kamera, temiz kompozisyon, Türkiye şehir dokusu (modern belediye, meydan, mahalle).
- **Slogan / kapanış:** *"Daha Akıllı Şehirler, Daha Mutlu Vatandaşlar."*
- **Format:** Ana kurgu **16:9** (YouTube/sunum). Her sahnede `[9:16 notu]` ile dikey reels uyarlaması var.
- **Süre:** ~85–95 sn hero film (9 sahne). Teaser için Sahne 1+3+9 = ~20 sn.

### Prompt kullanım ipuçları (Sora / Veo 3)
- **Yapıştır + kuyruk:** her görsel prompt'un sonuna ekle → `, 16:9, cinematic, shot on ARRI Alexa, 35mm, shallow depth of field, natural light, photorealistic, no on-screen text, no captions, no UI`.
- **Veo 3 (ses):** her sahnenin **Ses (Veo 3)** satırını görsel prompt'un altına ayrı paragraf olarak ekle. Veo 3 diyalog da üretebilir; **konuşan insan yüzü gösterme** (dudak senkronu riski) — anlatımı biz Türkçe seslendirme ile koyacağız, Veo 3 sadece **ambiyans + müzik hissi** üretsin.
- **Sora:** ses yok; sadece görsel prompt'u kullan, sonra bizim Türkçe seslendirme + müzik bindirilir.
- **Süre/çekim:** sahne başına 8 sn hedefle; tek kamera hareketi tarif et (örn. yalnızca "slow dolly-in") — Sora/Veo 3 tek net hareketi daha temiz render eder.
- **Tutarlılık:** maskot sahneleri (3, 9) için aynı karakter cümlesini birebir tekrarla; aksi halde her üretimde farklı robot çıkar. Mümkünse Sora'da bir maskot referans karesini "remix" et.
- **Negatif:** `distorted text, gibberish UI, warped faces, extra fingers, watermark, brand logos` — arayüzü AI'a çizdirme; gerçek ekranları biz bindireceğiz.

---

## SAHNE 1 — Açılış: Vatandaşın Sorunu (0:00–0:10)
**Konu (PDF):** Problem / "Belediyeye ulaşmak zor."
**Anlatım (TR):** "Bir sokak lambası günlerce yanmıyor. Bir çukur büyüyor. Vatandaş kime, nasıl ulaşacak?"
**Ekran metni (TR):** `Şikâyetiniz mi var?` → `Belediyeye ulaşmak artık çok kolay.`
**AI video prompt (EN):**
> A Turkish citizen, mid-30s, stands on a quiet residential street at dusk next to a flickering, broken street lamp. Subtle worry on the face, holding a smartphone, glancing up at the dim light. Slow dolly-in from a wide shot to a medium shot. Warm dusk light, blue hour tones, shallow depth of field, realistic, cinematic, no on-screen text, no captions.

**Kompozit:** yok (saf B-roll). Sonda KentOS mavi tint geçişi.
**[9:16 notu]** Dikey: kişiyi merkez-alt üçtebire al, üstte lamba; reels için ilk 1 sn yüz close-up ile başla (durdurucu).

---

## SAHNE 2 — Tek Cümleyle Başvuru (0:10–0:22)
**Konu (PDF):** Vatandaş Portalı · Başvuru Formu · "Anlatın → Kayda alın → Takip edin".
**Anlatım (TR):** "KentOS AI ile tek cümle yeter. Telefon beklemek, dilekçe yazmak yok."
**Ekran metni (TR):** `Tek Mesajla Başvuru` → `WhatsApp · Web · SMS — hepsi tek platformda`
**AI video prompt (EN):**
> Close-up of the same citizen's hands typing a short message on a modern smartphone, sitting comfortably at home by a window with soft morning light. Relaxed, relieved body language. Phone screen glows soft blue (no readable UI). Macro detail of thumbs typing, then leaning back calmly. Smooth handheld, warm interior, bokeh background, cinematic, no on-screen text, no captions.

**Kompozit:** telefon ekranına **gerçek başvuru formu** (`citizen_02_report_form.png`) + gönderim sonrası **TK başarı ekranı** (`citizen_03_report_success.png`) bindir.
**[9:16 notu]** Telefon dikey çerçeveyi doldursun; gerçek form ekranı tam-ekran bindirmeye çok uygun.

---

## SAHNE 3 — Konuşan AI Maskot KENT (0:22–0:38) ⭐
**Konu (PDF):** AI Maskot — yüzen sohbet, Bilgi Bankası'ndan grounded yanıt, TK kodu.
**Anlatım (TR):** "Maskotumuz KENT gerçek yapay zekâyla konuşur: sorularını yanıtlar, talebini oluşturur, takip kodunu anında verir."
**Ekran metni (TR):** `Yapay Zekâ Yanıtlar` → `Sorar, anlar, doğru birime iletir.`
**AI video prompt (EN):**
> A friendly rounded robot mascot character, glossy white body with municipal-blue (#0E5FD9) accents and a small glowing antenna light on its head, floating and gently bobbing in a bright, clean, minimal 3D environment. It tilts its head attentively and gives a warm, welcoming gesture with one hand. Soft studio lighting, subtle blue rim light, Pixar-style friendly 3D render, smooth slow orbit camera, shallow depth of field, no on-screen text, no captions.

**Kompozit:** maskot yanına **gerçek sohbet ekranları** — `citizen_15_maskot_qa.png` (çöp toplama soru-cevap) + `citizen_16_maskot_ticket.png` (otomatik TK kodu) yan panel olarak bindir.
**[9:16 notu]** Maskot üst yarı, gerçek sohbet alt yarı (split). Reels'in en güçlü sahnesi — teaser'da ilk bunu kullan.

---

## SAHNE 4 — Öğrenen & Sınıflandıran Yapay Zekâ (0:38–0:50) ⭐
**Konu (PDF):** Otomatik sınıflandırma (güven skoru), **Öğrenen Yapay Zeka**, AI intake özeti.
**Anlatım (TR):** "Her talebi yapay zekâ otomatik sınıflandırır, doğru birime yönlendirir. Sistem her yeni içerikle öğrenir, kullandıkça gelişir."
**Ekran metni (TR):** `Öğrenen Yapay Zekâ` → `Sınıflandırır · Yönlendirir · Kendini geliştirir`
**AI video prompt (EN):**
> Abstract data-visualization: streams of glowing blue particles flow from many directions into a central neural-network node, where they sort and branch cleanly into organized labeled paths. The network pulses brighter and grows new connecting nodes over time, conveying machine learning and self-improvement. Dark navy background, luminous #0E5FD9 and #3b9eff particles, elegant tech aesthetic, slow push-in, depth of field, cinematic 3D motion graphics, no on-screen text, no captions.

**Kompozit:** **AI intake özeti** gerçek ekranı (`admin_04_ticket_detail.png` — Niyet/Öncelik/Güven %95/Önerilen birim) merkeze bindir.
**[9:16 notu]** Dikey akış doğal; partiküller yukarıdan aşağı insin, node ortada.

---

## SAHNE 5 — Operatör Akışı (Yönetim Paneli) (0:50–1:02)
**Konu (PDF):** Admin · talep detayı, durum güncelleme, atama, hazır yanıt.
**Anlatım (TR):** "Operatör tek ekranda durumu günceller, birime atar, hazır yanıtla vatandaşa döner. Yapay zekâ önerir, insan onaylar."
**Ekran metni (TR):** `Operatör Akışı` → `AI önerir, insan onaylar.`
**AI video prompt (EN):**
> A focused municipal employee in a bright modern office works confidently at a large desktop monitor, calm and in control, occasionally nodding. Clean contemporary workplace, plants, soft daylight from large windows, other staff blurred in background. Slow lateral dolly past the desk, over-the-shoulder framing (screen content not readable). Professional, warm, productive mood, cinematic, shallow depth of field, no on-screen text, no captions.

**Kompozit:** monitöre **admin talepler listesi** (`admin_03_tickets.png`) + **talep detayı** (`admin_04_ticket_detail.png`) bindir.
**[9:16 notu]** Yüz + monitör dikey close; ekranı tam doldur.

---

## SAHNE 6 — Çok Kanal & Tek Satır Widget (1:02–1:14)
**Konu (PDF):** 11 kanal (WhatsApp, web, SMS, e-posta, Telegram, Instagram, Facebook, IVR…) + gömülebilir widget.
**Anlatım (TR):** "Belediye sitenize tek satır kod ekleyin, 5 dakikada canlı. WhatsApp, web, e-posta, SMS — hepsi aynı ticket'a düşer."
**Ekran metni (TR):** `Tek Satır Kod, 11 Kanal` → `Hepsi aynı ticket omurgasında.`
**AI video prompt (EN):**
> Multiple glowing communication-channel icons (chat bubbles, envelope, phone, message symbols) float in 3D space and elegantly converge along luminous blue lines into a single unified glowing hub in the center. Clean white-to-light-blue gradient environment, smooth orchestrated motion, premium SaaS product-explainer aesthetic, slow camera pull-back revealing all channels merging into one, #0E5FD9 accents, no on-screen text, no captions.

**Kompozit:** merkeze **Ayarlar > tek satır widget kodu** (`admin_10_settings.png`) + canlı **widget** (`citizen_10_widget.png`).
**[9:16 notu]** İkonlar çevreden merkeze; dikeyde dağılım daha dramatik.

---

## SAHNE 7 — Yönetim, SLA & Raporlar (1:14–1:26)
**Konu (PDF):** Dashboard KPI, SLA politika motoru, AI kullanım & maliyet, analitik.
**Anlatım (TR):** "Açık kuyruk, SLA ihlalleri, yapay zekâ otomasyon oranı ve maliyet — yöneticiye tek bakışta."
**Ekran metni (TR):** `Tek Bakışta Yönetim` → `SLA · KPI · AI maliyet`
**AI video prompt (EN):**
> Sleek animated business dashboard concept: clean abstract bar charts, rising line graphs and circular KPI gauges build up smoothly with glowing blue data, conveying control and clarity. Bright minimal interface aesthetic on a soft light background, subtle parallax, confident upward motion, premium analytics look, #0E5FD9 and #3b9eff, slow elegant reveal, no readable text, no on-screen captions.

**Kompozit:** gerçek **dashboard** (`admin_02_dashboard.png`) + **raporlar AI maliyet** (`admin_05_reports.png`) + **birim kuyrukları** (`admin_06_queues.png`).
**[9:16 notu]** KPI kartlarını dikey stack olarak kaydır.

---

## SAHNE 8 — Güvenlik & KVKK (1:26–1:36)
**Konu (PDF):** KVKK uyumu, TC maskeleme, vatandaş veri silme/anonimleştirme, denetim izi.
**Anlatım (TR):** "Tüm KVKK gereksinimleri yerleşik: anonimleştirme, veri silme, denetim izi — ayrı modül, ek ücret yok."
**Ekran metni (TR):** `KVKK Yerleşik` → `Maskeleme · Anonimleştirme · Denetim izi`
**AI video prompt (EN):**
> A glowing blue shield emblem forms from flowing light particles and locks into place with a soft pulse, surrounded by abstract floating data cards that get gently masked/encrypted (blurring into protected blocks). Calm, trustworthy, secure atmosphere, dark-to-blue gradient background, premium cybersecurity aesthetic, slow confident push-in, #0E5FD9 glow, no on-screen text, no captions.

**Kompozit:** **vatandaşlar / KVKK anonimleştirme** (`admin_09_citizens.png`) + **veri silme** (`citizen_12_data_deletion.png`).
**[9:16 notu]** Kalkan merkez; kartlar çevrede dikey dizilim.

---

## SAHNE 9 — Kapanış & CTA (1:36–1:30 son) ⭐
**Konu (PDF):** Slogan + 30 günlük pilot + iletişim.
**Anlatım (TR):** "KentOS AI — daha akıllı şehirler, daha mutlu vatandaşlar. 30 günlük ücretsiz pilotla bir hafta içinde canlı olun."
**Ekran metni (TR):** Logo + `Daha Akıllı Şehirler, Daha Mutlu Vatandaşlar` + `30 Gün Ücretsiz Pilot · izmirusulü.com`
**AI video prompt (EN):**
> Cinematic aerial drone shot slowly rising over a clean, modern Turkish city at golden hour — tidy streets, a central square, parks, people going about their day peacefully. Warm optimistic golden light, gentle lens flare, a sense of a well-run, harmonious smart city. The friendly white-and-blue robot mascot can appear small, waving, in a lower corner of a plaza (optional). Smooth ascending crane/drone motion, hopeful uplifting mood, cinematic color grade, no on-screen text, no captions.

**Kompozit:** son karede **KentOS logosu** (`docs/kentos-app-icon.png`) + slogan + CTA kartı (mevcut `outro.png` stili).
**[9:16 notu]** Dikey için drone'u alçak tut, sonda logoya zoom; CTA tam ekran.

---

## Ses Tasarımı (Veo 3 — sahne sahne)
> Görsel prompt'un altına ayrı paragraf olarak ekle. **Konuşma/insan sesi yok** (anlatımı biz koyacağız);
> Veo 3 yalnız ambiyans + müzikal his üretsin. İngilizce, kısa tut.

- **S1 Açılış:** `Audio: quiet evening street ambience, faint electrical buzz from the broken lamp, a soft melancholic piano note. No voices.`
- **S2 Başvuru:** `Audio: calm cozy interior, gentle morning birdsong outside, soft single phone keystroke clicks, light hopeful piano. No voices.`
- **S3 Maskot:** `Audio: bright friendly tech ambience, a soft cheerful UI chime as the mascot greets, warm uplifting synth pad. No voices.`
- **S4 Öğrenen AI:** `Audio: smooth futuristic data hum, subtle particle whooshes converging, building electronic pulse. No voices.`
- **S5 Operatör:** `Audio: calm modern office room tone, faint keyboard typing, quiet confident background score. No voices.`
- **S6 Çok kanal:** `Audio: light airy whooshes as icons converge, satisfying soft click when they unify, clean corporate synth. No voices.`
- **S7 Raporlar:** `Audio: crisp subtle data ticks as charts build, steady optimistic background music rising. No voices.`
- **S8 Güvenlik:** `Audio: deep reassuring sub-bass swell, a soft secure lock click, calm trustworthy ambient tone. No voices.`
- **S9 Kapanış:** `Audio: warm cinematic orchestral swell, gentle city ambience at golden hour, hopeful resolving chord. No voices.`

## Üretim Sonrası Akış (videoları bana verince)
1. AI kliplerini `kentos-tanitim/ai-clips/` altına `sahne01.mp4 … sahne09.mp4` adıyla koy.
2. Ben **gerçek ekran kompozitlerini** (`screenshots/*.png`), **Türkçe lower-third kartları** (`tools/build-video-cards.ts`) ve **anlatım/altyazıyı** bindiririm.
3. **FFmpeg montaj** (`tools/build-promo-video.ps1` genişletilir): intro → 9 sahne (kompozit + kart) → outro, müzik + opsiyonel TR seslendirme.
4. Çıktı: `KentOS-AI-Tanitim-Video.mp4` (16:9) ve `KentOS-AI-Tanitim-Reels.mp4` (9:16).

## Hızlı Kopyala-Yapıştır Prompt Listesi (sadece EN görsel promptlar)
> Sahne 1–9 promptları yukarıda **AI video prompt (EN)** satırlarında. Her birini araca tek tek
> yapıştır, 5–10 sn üret, yukarıdaki dosya adlarıyla kaydet. Marka tutarlılığı için her prompt'a
> gerekiyorsa `, municipal blue #0E5FD9 accents, warm trustworthy mood` ekleyebilirsin.
