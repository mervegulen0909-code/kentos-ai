# KentOS AI — Satış ve Tanıtım Planı

> **Hedef:** KentOS AI'ı Türk belediyelerine ve kurumsal alıcılara sunmak, demo göstermek ve satışa dönüştürmek.

**Hazırlanma tarihi:** 2026-05-29

---

## 1. Ürün Konumlandırma

### Tek Cümlelik Pitch
> "KentOS AI, vatandaşın tek cümleyle başlattığı talebi yapay zeka ile sınıflandırıp doğru birime yönlendiren, 11 kanaldan (WhatsApp, web, e-posta, SMS, Telegram, Instagram, Facebook, IVR, sosyal medya) tek ticket omurgasında birleştiren, SLA takibini otomatikleştiren ve belediye sitesine tek satır kodla entegre edilen vatandaş yönetim platformudur."

### Rakiplerden Farkı
| Özellik | KentOS AI | Rakipler (CRM/Alo 153) |
|---------|-----------|------------------------|
| AI sınıflandırma (otomatik birim yönlendirme) | ✅ Claude AI + deterministik fallback | ❌ Manuel triaj |
| Çok kanallı (WhatsApp/IG/FB/SMS/Email/Telegram/IVR/Web) | ✅ Tek ticket'ta birleşir | ❌ Kanal başına ayrı sistem |
| Belediye sitesine gömülebilir widget | ✅ Tek satır `<script>` | ❌ Ayrı portal |
| SLA omurgası + otomatik eskalasyon | ✅ Departman/kategori/öncelik bazlı | ❌ Manuel takip |
| KVKK uyumlu (anonimleştirme, veri silme, onay versiyonlama) | ✅ Yerleşik | ❌ Ek modül / yok |
| Çok-kiracılı (multi-tenant) | ✅ Her belediye izole | ❌ Tekil kurulum |
| Vatandaş self-servis (takip kodu, e-randevu, SSS) | ✅ | ❌ Sınırlı |
| Maliyet | SaaS / sunucu başına — ölçeklenebilir | Lisans + danışmanlık |

---

## 2. Hedef Kitle

### Birincil: Belediyeler
| Segment | Nüfus | Karar Verici | Acı Noktası | KentOS Çözümü |
|---------|-------|-------------|-------------|---------------|
| Büyükşehir belediyeleri | 1M+ | Bilgi İşlem Müdürü / Genel Sekreter | Alo 153 aşırı yük, kanal dağınıklığı, SLA takipsizliği | Çok kanallı AI intake, otomatik yönlendirme, SLA dashboard |
| İl/İlçe belediyeleri | 50K-1M | Başkan Yardımcısı / Yazı İşleri | Personel yetersizliği, halkla ilişkiler masrafı | AI asistan %50+ talebi otomatik çözer, 7/24 çalışır |
| Küçük belediyeler | <50K | Belediye Başkanı | Bütçe kısıtı, dijitalleşme ihtiyacı | Düşük maliyetli SaaS, kurulum gerektirmez |

### İkincil: Kurumsal Alıcılar
- **Belediye BT çözüm entegratörleri** (Türksat, Logo, Netsis dünyası) — beyaz etiket / OEM
- **Akıllı şehir proje ofisleri** (TÜBİTAK, Kalkınma Ajansları destekleri)
- **Özel sektör (AVM, site yönetimi, kampüs)** — aynı ticket/SLA omurgası uygulanabilir

---

## 3. Satış Materyalleri (Hazırlanması Gerekenler)

### 3.1 Demo Ortamı ✅ (HAZIR)
- **Canlı demo:** `vatandas.izmirusulü.com` (vatandaş portalı) + `admin.izmirusulü.com` (yönetim paneli)
- Demo tenant: `demo-belediye` (203 ticket, 58 vatandaş, 27 departman, 23 kategori)
- Giriş: `admin@demo.local` / `ChangeMe123!`
- Widget gömülü: `cebtecep.com` üzerinde canlı (belediye sitesi simülasyonu)

### 3.2 Sunum / Pitch Deck (YAPILMALI)
10-15 slaytlık sunum:
1. **Problem:** Belediyeye ulaşan talepler dağınık (telefon, dilekçe, sosyal medya), SLA takibi yok, vatandaş memnuniyetsizliği
2. **Çözüm:** KentOS AI — tek omurga, AI sınıflandırma, çok kanal, SLA
3. **Nasıl çalışır:** (3 adım) Vatandaş yazar → AI sınıflandırır → Birim çözer
4. **Canlı demo ekran görüntüleri:** Widget, başvuru formu, AI intake, admin dashboard, SLA, CSAT
5. **Kanallar:** WhatsApp + Web + Email + SMS + Telegram + Instagram + Facebook + IVR + Sosyal Medya İzleme
6. **AI yetenekleri:** Otomatik sınıflandırma, yanıt önerisi, özetleme, duygu analizi, duplicate tespiti, akıllı atama
7. **Vatandaş deneyimi:** Takip kodu, e-randevu, SSS, KVKK self-servis
8. **Operasyon paneli:** Dashboard, SLA alarm, operatör performansı, raporlar, CSV export
9. **Güvenlik & KVKK:** TOTP 2FA, IP allowlist, PII maskeleme, veri saklama/silme, denetim izi
10. **Entegrasyon:** Tek satır script, 5 dakikada canlı
11. **Fiyatlandırma** (sonraki bölüm)
12. **Referans / İletişim**

### 3.3 Tanıtım Web Sitesi (YAPILMALI)
- `izmirusulü.com` veya ayrı bir domain (`kentos.ai` / `kentosai.com.tr`)
- Landing page: değer önerisi, 3 adım nasıl çalışır, özellik listesi, canlı demo linki, iletişim formu
- Blog/İçerik: "Belediyede dijital dönüşüm", "Vatandaş memnuniyeti nasıl artırılır", "KVKK uyumlu belediye çözümleri"

### 3.4 Broşür / PDF (YAPILMALI)
- 2 sayfalık özet broşür (başkanlara / karar vericilere elden verilecek)
- Teknik spec sheet (BT müdürlerine)

### 3.5 Demo Videosu (YAPILMALI)
- 2-3 dakikalık screencast: vatandaş başvuru → AI sınıflandırma → operatör çözüm → vatandaş bildirim
- Sosyal medya için 30 saniyelik kısa versiyon

---

## 4. Fiyatlandırma Stratejisi

### Model: SaaS (Aylık/Yıllık Abonelik)
Çok-kiracılı mimari olduğu için sunucu maliyeti düşük, marj yüksek.

| Paket | Hedef | Aylık Fiyat (önerilen) | İçerik |
|-------|-------|------------------------|--------|
| **Başlangıç** | Küçük belediye (<50K) | 5.000-10.000 TL/ay | 5 operatör, 3 kanal (web+WA+email), 1.000 ticket/ay, temel AI |
| **Profesyonel** | İlçe belediyesi (50K-500K) | 15.000-30.000 TL/ay | 20 operatör, tüm kanallar, 5.000 ticket/ay, tam AI, SLA, raporlar |
| **Kurumsal** | Büyükşehir (500K+) | 50.000-100.000 TL/ay | Sınırsız operatör, sınırsız ticket, özel entegrasyon, dedicated destek, SLA garantisi |
| **Özel Kurulum** | Büyükşehir / güvenlik gerektiren | Proje bazlı | On-premise veya private cloud, kaynak kod lisansı, özelleştirme |

### İlk Satış Stratejisi
- **Ücretsiz 30 günlük pilot** — tenant açılır, gerçek verilerle test edilir
- **Yıllık ödeme %20 indirim** — cash flow güvencesi
- **Referans indirimi** — ilk 3 belediye %50 indirimli (referans olarak kullanım izni karşılığı)

---

## 5. Satış Kanalları & Stratejisi

### 5.1 Doğrudan Satış (İlk Aşama)
1. **Hedef liste çıkar:** İzmir, Aydın, Muğla bölgesindeki ilçe belediyeleri (coğrafi yakınlık)
2. **Soğuk e-posta / LinkedIn:** Belediye başkan yardımcıları ve BT müdürlerine
3. **Fiziksel ziyaret:** Demo laptop'la gidip canlı gösterim (en etkili)
4. **Belediye Meclisi sunumu:** Karar vericilere toplu sunum

### 5.2 Dijital Pazarlama
- **Google Ads:** "belediye şikayet yönetimi", "belediye CRM", "vatandaş talep sistemi", "alo 153 alternatif"
- **LinkedIn kampanya:** Belediye BT karar vericilerine hedefli
- **SEO:** Blog içerikleri (belediye dijitalleşme, KVKK, vatandaş memnuniyeti)
- **Sosyal medya:** X/Twitter, LinkedIn — belediye dünyası içerikleri

### 5.3 İhale & Kamu Alımları
- **EKAP** (Elektronik Kamu Alımları Platformu) takibi — belediye IT ihaleleri
- **Teknik şartname uyumluluğu:** KentOS'un karşıladığı kriterleri hazır tutmak
- **Referans mektubu:** Pilot belediyelerin deneyim mektubu

### 5.4 Ortaklıklar
- **Belediye BT entegratörleri** — bayilik/komisyon modeli
- **Telekom operatörleri** (Türk Telekom, Turkcell) — belediye paketlerine ekleme
- **Akıllı şehir platformları** — API entegrasyonu

### 5.5 Etkinlikler
- **Türkiye Belediyeler Birliği** toplantıları — stand / sunum
- **Smart City Expo Turkey** — stant
- **Yerel belediye fuarları** — demo köşesi
- **Webinar serisi:** "Belediyenizi 24/7 dijital asistanla güçlendirin"

---

## 6. Satış Süreci (Pipeline)

```
İlk Temas → Demo → Pilot (30 gün) → Değerlendirme → Teklif → Sözleşme → Onboarding
   1 hafta    1 gün    30 gün        1 hafta       1 hafta   2 hafta    1 hafta
```

### Adımlar:
1. **İlk Temas (Hafta 1):** E-posta/telefon, acı noktası keşfi, demo randevusu
2. **Canlı Demo (30 dk):** `admin.izmirusulü.com` üzerinden canlı gösterim — vatandaş başvuru → AI sınıflandırma → operatör çözüm akışı
3. **Ücretsiz Pilot (30 gün):** Belediyeye özel tenant açılır, gerçek departman/kategori yapılandırılır, 5-10 operatör eklenir, widget belediye sitesine gömülür
4. **Değerlendirme Toplantısı:** Pilot sonuçları (ticket sayısı, AI otomasyon oranı, ortalama çözüm süresi, CSAT) sunulur
5. **Teklif & Sözleşme:** Pakete göre fiyat, SLA taahhüdü, KVKK DPA (veri işleme sözleşmesi)
6. **Onboarding:** Departman/kategori/SLA yapılandırma, operatör eğitimi (2 saat), widget entegrasyonu, WhatsApp Business bağlantısı

---

## 7. Demo Senaryosu (Satış Toplantısı İçin)

### 15 Dakikalık Canlı Demo Akışı:

**Dakika 1-3: Vatandaş Deneyimi**
1. `vatandas.izmirusulü.com/demo-belediye/report` aç
2. "Atatürk Caddesi'nde sokak lambası üç gündür yanmıyor, akşamları çok karanlık" yaz
3. Gönder → takip kodu oluşur (TK-XXXX...)
4. "Bakın, vatandaş 15 saniyede başvurusunu yaptı — telefon beklemedi, dilekçe yazmadı"

**Dakika 3-5: AI Sınıflandırma**
1. `admin.izmirusulü.com`'a geç, login ol
2. Yeni ticket'ı aç → AI intake özeti göster: niyet, önerilen kategori, önerilen birim, güven skoru
3. "Yapay zeka otomatik olarak Fen İşleri'ne yönlendirdi, operatör sadece onayladı"

**Dakika 5-8: Operatör Akışı**
1. Durum güncelle (Yeni → Atandı → Çözülüyor)
2. AI yanıt önerisi al → "Ekibimiz bugün sahaya çıkacak" — tek tıkla gönder
3. Vatandaşa mesaj gider → takip kodundan durumu görebilir

**Dakika 8-10: Çok Kanal**
1. "Aynı vatandaş WhatsApp'tan da yazabilir — aynı ticket'a düşer"
2. Widget'ı göster: `cebtecep.com` → sağ alt köşede asistan butonu
3. "Belediye sitenize tek satır kod eklersiniz, 5 dakikada canlı"

**Dakika 10-12: Yönetim & SLA**
1. Dashboard: açık kuyruk, SLA ihlal, CSAT
2. Birim kuyrukları: departman bazlı iş yükü
3. Raporlar: AI otomasyon oranı (%51), operatör performansı, kanal dağılımı

**Dakika 12-14: Güvenlik & KVKK**
1. Vatandaş anonimleştirme (tek tık)
2. Denetim izi (kimin ne zaman ne yaptığı)
3. Veri saklama süresi ayarları
4. "Tüm KVKK gereksinimleri yerleşik — ayrı modül/ücret yok"

**Dakika 14-15: Kapanış**
1. "30 günlük ücretsiz pilot başlatalım — gerçek departmanlarınız, gerçek vatandaşlarınız"
2. "Widget'ı sitenize ekleriz, WhatsApp hattınızı bağlarız, 1 hafta içinde canlı"

---

## 8. Öncelikli Yapılacaklar Listesi

### Acil (Bu Hafta)
- [ ] Pitch deck hazırla (10-15 slayt, Türkçe, ekran görüntülü)
- [ ] 2 dakikalık demo videosu çek (ekran kaydı + sesli anlatım)
- [ ] Demo ortamını temizle (smoke test kullanıcıları sil, demo verilerini düzenle)
- [ ] İletişim sayfası / formu ekle (`izmirusulü.com` veya ayrı domain)

### Kısa Vadeli (Bu Ay)
- [ ] Tanıtım web sitesi (`kentos.ai` veya benzeri domain al + landing page)
- [ ] PDF broşür tasarla (2 sayfa, karar vericilere elden verilecek)
- [ ] Hedef belediye listesi çıkar (İzmir/Aydın/Muğla ilçe belediyeleri, 20-30 adet)
- [ ] LinkedIn şirket sayfası + ilk 5 içerik
- [ ] İlk 5 belediyeye soğuk e-posta / telefon

### Orta Vadeli (1-3 Ay)
- [ ] İlk pilot belediye (ücretsiz, referans karşılığı)
- [ ] Pilot sonuçlarını case study olarak belgele
- [ ] Google Ads kampanyası başlat
- [ ] Belediyeler Birliği / Smart City etkinliklerine başvur
- [ ] WhatsApp Business API onayı al (Meta Business Manager)

### Uzun Vadeli (3-6 Ay)
- [ ] İlk ücretli müşteri
- [ ] 3 referans belediye
- [ ] EKAP ihale takip sistemi kur
- [ ] Entegratör ortaklığı (1-2 firma)
- [ ] e-Devlet entegrasyonu (TC kimlik doğrulama canlıya al)

---

## 9. Anahtar Mesajlar (Her Kanalda Kullanılacak)

### Başkanlara (Karar Verici)
> "Vatandaşınız 7/24 tek cümleyle başvurabilsin, yapay zeka doğru birime yönlendirsin, siz de SLA'dan asla sapmayın. Belediye sitenize 5 dakikada ekleyin."

### BT Müdürlerine (Teknik Karar Verici)
> "11 kanal tek ticket omurgasında, KVKK yerleşik, API-first mimari, Docker ile 30 dakikada kurulum, belediye sitenize tek satır script ile widget."

### Vatandaş İletişiminde (Belediye Sosyal Medyasında)
> "Artık belediyenize tek cümleyle ulaşın — WhatsApp, web veya telefonla. Takip kodunuzla başvurunuzu anında izleyin."

---

## 10. Rekabet Analizi & Konumlandırma

### Türkiye'deki Mevcut Çözümler
| Çözüm | Zayıf Yönü | KentOS Avantajı |
|-------|-----------|-----------------|
| **Alo 153 (Büyükşehir)** | Sadece telefon, manuel triaj, SLA takibi zor | 11 kanal, AI otomatik sınıflandırma, gerçek zamanlı SLA |
| **CityConnect / BelediyeNet** | Eski mimari, mobil zayıf, AI yok | Modern web, AI-first, responsive |
| **SAP / Oracle CRM** | Çok pahalı, uzun kurulum, belediye özelleştirmesi zor | Belediye-native, hızlı kurulum, uygun fiyat |
| **Manuel (Excel/Word)** | Takipsiz, raporlanamaz, KVKK riski | Tam dijital, otomatik raporlar, KVKK yerleşik |
| **Genel ticket sistemleri (Zendesk/Freshdesk)** | Belediye terminolojisi yok, Türkçe AI yok, KVKK'ya uyum zor | Türk belediyesi için tasarlandı, Türkçe AI, KVKK native |

---

## 11. Teknik Hazırlık (Satış Öncesi)

### Demo Ortamı İyileştirmeleri
- [ ] Demo tenant'a gerçekçi veriler ekle (farklı durumlarda 20-30 ticket)
- [ ] FAQ'ya 5-10 örnek makale ekle (çöp toplama, su kesintisi, imar vb.)
- [ ] 3-4 randevu slotu oluştur (canlı demo sırasında booking gösterebilmek için)
- [ ] WhatsApp demo hattı (Meta sandbox veya gerçek numara)
- [ ] Demo sırasında kullanılacak "hızlı senaryo kartları" hazırla

### Belediye Onboarding Checklist'i (Pilot İçin)
1. Tenant oluştur (slug: belediye-adi)
2. Departmanları yapılandır (Fen İşleri, Temizlik, Zabıta, Park/Bahçe, vb.)
3. Kategorileri ekle (yol/kaldırım, aydınlatma, çöp, gürültü, vb.)
4. SLA politikalarını ayarla (acil: 4 saat, normal: 48 saat, vb.)
5. Operatör hesaplarını oluştur (departman bazlı)
6. Widget'ı belediye sitesine ekle (tek satır script)
7. WhatsApp Business hattını bağla (opsiyonel)
8. 2 saatlik operatör eğitimi ver
9. 1 hafta sonra check-in toplantısı

---

## 12. Başarı Metrikleri (Takip Edilecek)

| Metrik | Hedef (6 ay) |
|--------|-------------|
| Demo gösterilen belediye sayısı | 20+ |
| Pilot başlayan belediye | 5+ |
| Ücretli müşteriye dönüşen | 2-3 |
| Aylık tekrar eden gelir (MRR) | 30.000-100.000 TL |
| AI otomasyon oranı (pilot belediyelerde) | %40+ |
| Vatandaş CSAT ortalaması | 4.0+ / 5 |
| Ortalama satış döngüsü | 60-90 gün |
