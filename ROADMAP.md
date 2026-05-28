# KentOS AI — Feature Roadmap

## FAZ 1 — Kritik Bug Fix + Hızlı Kazanımlar (Schema değişikliği yok)
- [x] 1.1 Multi-kanal bildirim fan-out (notifications.processor.ts bug fix)
- [x] 1.2 FCM push on public message reply (1 satır fix)
- [x] 1.3 Tarih aralıklı analitik (?from=&to= query params)
- [x] 1.4 SLA trend grafiği (yeni endpoint)
- [x] 1.5 Akıllı atama / smart assign (yeni endpoint)
- [x] 1.6 AI ticket öncelik önerisi (intake prompt + schema field)
- [x] 1.7 OSM ters geocoding (yeni BullMQ job)
- [x] 1.8 Vatandaş şikayet yükseltme / escalate (yeni endpoint)
- [x] 1.9 Admin IP allowlist (tenant field + guard)
- [x] 1.10 Ticket takip timeline API (yeni public endpoint)
- [x] 1.11 Kategori auto-learning (mevcut stub doldur)

## FAZ 2 — Uyumluluk & Güvenlik
- [x] 2.1 TC Kimlik No maskeleme interceptor (KVKK Madde 6)
- [x] 2.2 KVKK rıza sürüm takibi (KvkkConsentVersion model)
- [x] 2.3 Staff için 2FA/TOTP (otplib)
- [x] 2.4 Attachment VirusTotal escalation

## FAZ 3 — Operatör Verimliliği
- [x] 3.1 Canned reply şablonları (kişisel + paylaşılan)
- [x] 3.2 Ticket tags / labels
- [x] 3.3 @Mention iç notlarda
- [x] 3.4 Ticket watchers / followers
- [x] 3.5 Ticket sub-tasks / checklist
- [x] 3.6 Operatör çevrimiçi durumu (Redis presence)

## FAZ 4 — AI Geliştirmeleri
- [x] 4.1 AI ticket özetleme (ticket-summary purpose)
- [x] 4.2 Otomatik follow-up tespiti (waiting-info intelligence)
- [x] 4.3 Sentiment analizi (ticket mesajlarında)
- [x] 4.4 Haftalık AI yönetici digest (email ile)

## FAZ 5 — Yeni Kanallar & Entegrasyonlar
- [x] 5.1 Email inbound (Postmark webhook → ticket)
- [x] 5.2 Telegram kanalı
- [x] 5.3 WhatsApp template yönetim UI
- [x] 5.4 Microsoft Teams / Slack notification sink

## FAZ 6 — Raporlama & Analitik
- [x] 6.1 Excel/CSV export (exceljs)
- [x] 6.2 Zamanlanmış rapor gönderimi (ReportSubscription)
- [x] 6.3 Coğrafi ısı haritası (Leaflet.js)
- [x] 6.4 Cursor tabanlı pagination

## FAZ 7 — Vatandaş Deneyimi
- [x] 7.1 Bilgi bankası / self-servis FAQ
- [x] 7.2 Randevu sistemi (e-randevu)
- [x] 7.3 Çok dilli destek (Kürtçe/Arapça)

## FAZ 8 — Gelişmiş Özellikler
- [x] 8.1 Semantik duplicate tespiti (pgvector)
- [x] 8.2 e-Devlet kimlik doğrulama (KPS entegrasyonu)
- [x] 8.3 Ses kanalı / IVR (Twilio Voice + Whisper)
- [x] 8.4 X (Twitter) sosyal medya izleme
