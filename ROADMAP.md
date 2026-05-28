# KentOS AI — Feature Roadmap

## FAZ 1 — Kritik Bug Fix + Hızlı Kazanımlar (Schema değişikliği yok)
- [ ] 1.1 Multi-kanal bildirim fan-out (notifications.processor.ts bug fix)
- [ ] 1.2 FCM push on public message reply (1 satır fix)
- [ ] 1.3 Tarih aralıklı analitik (?from=&to= query params)
- [ ] 1.4 SLA trend grafiği (yeni endpoint)
- [ ] 1.5 Akıllı atama / smart assign (yeni endpoint)
- [ ] 1.6 AI ticket öncelik önerisi (intake prompt + schema field)
- [ ] 1.7 OSM ters geocoding (yeni BullMQ job)
- [ ] 1.8 Vatandaş şikayet yükseltme / escalate (yeni endpoint)
- [ ] 1.9 Admin IP allowlist (tenant field + guard)
- [ ] 1.10 Ticket takip timeline API (yeni public endpoint)
- [ ] 1.11 Kategori auto-learning (mevcut stub doldur)

## FAZ 2 — Uyumluluk & Güvenlik
- [ ] 2.1 TC Kimlik No maskeleme interceptor (KVKK Madde 6)
- [ ] 2.2 KVKK rıza sürüm takibi (KvkkConsentVersion model)
- [ ] 2.3 Staff için 2FA/TOTP (otplib)
- [ ] 2.4 Attachment VirusTotal escalation

## FAZ 3 — Operatör Verimliliği
- [ ] 3.1 Canned reply şablonları (kişisel + paylaşılan)
- [ ] 3.2 Ticket tags / labels
- [ ] 3.3 @Mention iç notlarda
- [ ] 3.4 Ticket watchers / followers
- [ ] 3.5 Ticket sub-tasks / checklist
- [ ] 3.6 Operatör çevrimiçi durumu (Redis presence)

## FAZ 4 — AI Geliştirmeleri
- [ ] 4.1 AI ticket özetleme (ticket-summary purpose)
- [ ] 4.2 Otomatik follow-up tespiti (waiting-info intelligence)
- [ ] 4.3 Sentiment analizi (ticket mesajlarında)
- [ ] 4.4 Haftalık AI yönetici digest (email ile)

## FAZ 5 — Yeni Kanallar & Entegrasyonlar
- [ ] 5.1 Email inbound (Postmark webhook → ticket)
- [ ] 5.2 Telegram kanalı
- [ ] 5.3 WhatsApp template yönetim UI
- [ ] 5.4 Microsoft Teams / Slack notification sink

## FAZ 6 — Raporlama & Analitik
- [ ] 6.1 Excel/CSV export (exceljs)
- [ ] 6.2 Zamanlanmış rapor gönderimi (ReportSubscription)
- [ ] 6.3 Coğrafi ısı haritası (Leaflet.js)
- [ ] 6.4 Cursor tabanlı pagination

## FAZ 7 — Vatandaş Deneyimi
- [ ] 7.1 Bilgi bankası / self-servis FAQ
- [ ] 7.2 Randevu sistemi (e-randevu)
- [ ] 7.3 Çok dilli destek (Kürtçe/Arapça)

## FAZ 8 — Gelişmiş Özellikler
- [ ] 8.1 Semantik duplicate tespiti (pgvector)
- [ ] 8.2 e-Devlet kimlik doğrulama (KPS entegrasyonu)
- [ ] 8.3 Ses kanalı / IVR (Twilio Voice + Whisper)
- [ ] 8.4 X (Twitter) sosyal medya izleme
