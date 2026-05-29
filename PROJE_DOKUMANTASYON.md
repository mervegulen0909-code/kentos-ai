# KentOS AI — Proje Dokümantasyonu

> Türk belediyeleri için **çok-kiracılı (multi-tenant)** vatandaş yönetim ve talep (ticket) platformu.
> Vatandaş tek cümleyle başvurur; sistem AI ile sınıflandırır, doğru birime yönlendirir, SLA omurgasında takip eder ve çok kanaldan (WhatsApp, web, e-posta, SMS, Telegram, Instagram, Facebook, IVR, sosyal medya) tek ticket akışında birleştirir.

**Doküman tarihi:** 2026-05-29
**Kapsam:** Tüm geliştirme aşamaları (faz1–faz8 + öncesi) ve tüm uygulama/servis özellikleri.

---

## İçindekiler
1. [Mimari Genel Bakış](#1-mimari-genel-bakış)
2. [Teknoloji Yığını](#2-teknoloji-yığını)
3. [Geliştirme Aşamaları (Faz Haritası)](#3-geliştirme-aşamaları-faz-haritası)
4. [Veri Modeli (34 Model + Enum'lar)](#4-veri-modeli)
5. [Backend (API) Modülleri](#5-backend-api-modülleri)
6. [Vatandaş Portalı (citizen-web)](#6-vatandaş-portalı-citizen-web)
7. [Yönetim Paneli (admin-web)](#7-yönetim-paneli-admin-web)
8. [Worker (Arka Plan İşleri)](#8-worker-arka-plan-işleri)
9. [WhatsApp Gateway (Çok Kanallı Geçit)](#9-whatsapp-gateway)
10. [Paylaşılan Paketler](#10-paylaşılan-paketler)
11. [Güvenlik & KVKK Katmanı](#11-güvenlik--kvkk-katmanı)
12. [AI Özellik Haritası](#12-ai-özellik-haritası)
13. [Portlar & Çalıştırma](#13-portlar--çalıştırma)

---

## 1. Mimari Genel Bakış

pnpm monorepo. 5 uygulama + 2 paylaşılan paket.

```
┌──────────────────────┐      ┌──────────────────────┐
│  citizen-web (3102)   │      │   admin-web (3101)    │
│  Vatandaş portalı     │      │   Operasyon paneli    │
└──────────┬───────────┘      └──────────┬───────────┘
           │      REST + SSE (CORS)        │
           └──────────────┬────────────────┘
                          ▼
              ┌────────────────────────┐
              │   NestJS API (3100)    │  26 modül, JWT+RBAC, multi-tenant
              └───┬──────────┬─────────┘
                  │BullMQ     │HTTP
       ┌──────────▼───┐  ┌────▼─────────────────┐
       │ worker        │  │ whatsapp-gateway(3120)│ Meta/Twilio/Postmark
       │ 9 kuyruk+DLQ  │  │ WA/IG/FB/SMS/Email    │
       └──────┬────────┘  └───────────────────────┘
              │
    ┌─────────▼──────────────────────────────────┐
    │ PostgreSQL (5432) · Redis (6379) ·          │
    │ MinIO/S3 (9000) · ClamAV (3310)             │
    └─────────────────────────────────────────────┘
```

- **Çok-kiracılık:** Her kimlik doğrulamalı uç JWT'deki `tenantId` ile izole; her public uç `:tenantSlug` ile izole.
- **Roller (RBAC):** `SUPER_ADMIN`, `TENANT_ADMIN`, `MANAGER`, `DEPARTMENT_STAFF`, `OPERATOR`, `READ_ONLY`.

---

## 2. Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| API | NestJS (TypeScript, ESM), `tsx watch` dev |
| Web | Next.js 15 (App Router), React 19, Server Actions |
| Veritabanı | PostgreSQL 16 + Prisma ORM 6 |
| Kuyruk/Cache | Redis 7 + BullMQ |
| Dosya | MinIO / S3 (presigned URL) |
| Antivirüs | ClamAV |
| AI | Anthropic (Claude), OpenAI (embedding + Whisper) — her özellikte deterministik fallback |
| Kimlik | JWT (access/refresh), TOTP 2FA (otplib), Firebase (vatandaş), e-Devlet KPS |
| Hata İzleme | Sentry |
| Paket Yöneticisi | pnpm (workspace) |

---

## 3. Geliştirme Aşamaları (Faz Haritası)

Toplam **28 migration**: 21 faz-öncesi + 7 fazlı (FAZ 1, 2, 3, 5, 6, 7, 8). **FAZ 4'ün migration'ı yoktur** — FAZ 4 şema değişikliği içermedi; o dönemin işleri `b4/c1/c2/c3`, `e1`, `f4` harf serisiyle taşındı.

### Faz Öncesi (Temel İnşa + Sağlamlaştırma)

| # | Migration | Eklenenler |
|---|-----------|------------|
| 1 | `init` | Temel şema: 16 tablo (Tenant, Department, Category, Neighborhood, SlaPolicy, MessageTemplate, User, UserDepartment, Citizen, Ticket, TicketMessage, Attachment, Conversation, ChannelEvent, AuditLog, AiRun, ManagerReport) + tüm temel enum'lar |
| 2 | `add_public_tracking_token` | `Ticket.publicTrackingToken` — anonim takip kodu |
| 3 | `message_template_channel_uniqueness` | Şablonlarda kanal-bazlı kısmi unique index |
| 4 | `channel_event_delivery_idempotency` | Webhook idempotency anahtarı |
| 5 | `tenant_widget_settings` | Widget yapılandırması (başlık, karşılama, izinli origin'ler) |
| 6 | `citizen_identity_reconciliation` | `CitizenIdentifier` tablosu + vatandaş birleştirme (merge) |
| 7 | `multi_channel_outbound` | `OutboundDelivery` + Instagram/Facebook/SMS kanalları |
| 8 | `citizen_identity_phase3_enforcement_marker` | İşaret migration'ı (DDL yok) |
| 9-10 | `channel_type_email`, `..._source_email` | E-posta kanalı enum'ları |
| 11 | `add_tenant_retention_overrides` | Kiracı bazlı veri saklama yapılandırması |
| 12 | `add_attachment_scan_status` (W3.3) | `AttachmentScanStatus` enum + ClamAV tarama alanları |
| 13 | `add_ai_run_telemetry` (W3.4) | AI token/maliyet telemetrisi |
| 14 | `add_tenant_ai_budget_overrides` (W4.3) | Kiracı bazlı AI bütçe sınırları |
| 15 | `drop_manager_reports` | Boş (forward-only determinizm için) |
| 16 | `add_sla_breached_at_and_outbound_last_attempt` | SLA ihlal zamanı + outbound son deneme |
| 17 | `b4_c1_c2_c3_features` | **B4:** WhatsApp template linki · **C1:** CSAT skoru · **C2:** `TenantWebhook` · **C3:** `CitizenDeviceToken` (push) |
| 18 | `f4_neighborhood_department_routing` (F4) | Mahalle → departman otomatik yönlendirme |
| 19 | `e1_performance_indexes` (E1) | Ticket üzerinde 3 bileşik performans index'i |
| 20 | `citizen_firebase_uid` | Firebase Auth entegrasyonu |
| 21 | `password_reset_fields` | Parola sıfırlama token alanları |

### FAZ 1–8 (Fazlı Özellik Programı, hepsi 2026-05-28)

| Faz | Migration | Eklenen Özellikler |
|-----|-----------|--------------------|
| **FAZ 1** | `faz1_tenant_ip_allowlist` | Kiracı bazlı **admin IP allowlist** (güvenlik sertleştirme) |
| **FAZ 2** | `faz2_kvkk_totp` | **KVKK onay versiyonlama** (`KvkkConsentVersion` + vatandaş onayı) · **TOTP 2FA** (kullanıcı) |
| **FAZ 3** | `faz3_operator_efficiency` | **Hazır yanıtlar** (`CannedReply`) · **Ticket etiketleri** (`TicketTag`) · **Takipçiler** (`TicketWatcher`) · **Kontrol listesi** (`TicketChecklistItem`) |
| **FAZ 5** | `faz5_telegram_channel` | **Telegram** kanalı · **WhatsApp şablonları** (Meta senkron) · **Bildirim sink'leri** (Slack/Teams) |
| **FAZ 6** | `faz6_report_subscription` | **Zamanlanmış rapor abonelikleri** (günlük/haftalık/aylık e-posta) |
| **FAZ 7** | `faz7_citizen_experience` | **Bilgi Bankası / SSS** (`FaqArticle`, çok dilli) · **E-Randevu** (`AppointmentSlot` + `Appointment`) |
| **FAZ 8** | `faz8_advanced_features` | **Twitter/X** kanalı · **Semantik benzerlik** (`Ticket.embeddingJson` — duplicate tespiti) · **Sosyal medya izleme** (`SocialMonitorRule`) · **IVR çağrı kayıtları** (`IvrCall` + Whisper transkripsiyon) |

> **Not (FAZ 8.1):** `Ticket.embeddingJson` şu an TEXT (JSON dizi). `pgvector` `vector(1536)` + ivfflat index'e geçiş, `vector` eklentisi etkinleştirilince yapılabilir (migration yorumunda belgeli).

---

## 4. Veri Modeli

### 34 Model

| Model | Amaç |
|-------|------|
| **Tenant** | Kök çok-kiracılık varlığı (bir belediye); widget, saklama, AI bütçe, IP allowlist config |
| **Department** | Kiracı içi birim (Temizlik, Su…); ticket yönlendirir |
| **Category** | Talep sınıflandırma taksonomisi; varsayılan öncelik |
| **Neighborhood** | Mahalle (opsiyonel GeoJSON poligon) — konum + departman yönlendirme |
| **SlaPolicy** | Öncelik bazlı yanıt/çözüm SLA hedefleri |
| **MessageTemplate** | Kanal bazlı yerelleştirilmiş mesaj şablonları |
| **User** | Personel/admin hesabı (rol, parola-sıfırlama, TOTP 2FA) |
| **UserDepartment** | Kullanıcı↔departman M2M üyelik |
| **KvkkConsentVersion** | Versiyonlanmış KVKK onay metinleri |
| **Citizen** | Vatandaş kaydı (merge, Firebase UID, KVKK onayı) |
| **CitizenIdentifier** | Normalize telefon/e-posta kimlikleri (dedup) |
| **Ticket** | Çekirdek talep: durum, öncelik, SLA, CSAT, konum, AI sınıflandırma, embedding |
| **TicketMessage** | Ticket mesajı (public/internal) |
| **Attachment** | Dosya eki + antivirüs tarama durumu |
| **Conversation** | Kanal sohbet oturumu (handoff bayrağı) |
| **ChannelEvent** | Ham gelen webhook/olay (idempotency anahtarlı) |
| **OutboundDelivery** | Çok kanallı giden mesaj + teslim durumu/retry |
| **AuditLog** | Değişmez denetim izi (before/after, aktör, IP) |
| **TenantWebhook** | Kiracı giden webhook abonelikleri |
| **CitizenDeviceToken** | Push bildirim cihaz token'ları |
| **AiRun** | AI/LLM çağrı telemetrisi (token, maliyet, başarı) |
| **ManagerReport** | Periyodik yönetim raporu |
| **CannedReply** | Hazır yanıt parçacıkları (paylaşılan/kişisel) |
| **TicketTag** | Renkli etiket (M2M) |
| **TicketWatcher** | Ticket takipçisi |
| **TicketChecklistItem** | Ticket alt-görev / kontrol listesi |
| **ReportSubscription** | Zamanlanmış e-posta rapor aboneliği |
| **FaqArticle** | Bilgi bankası makalesi (çok dilli, yayınlanabilir, görüntülenme) |
| **AppointmentSlot** | Kapasiteli randevu zaman dilimi |
| **Appointment** | Vatandaş randevu kaydı |
| **WhatsappTemplate** | Meta'dan senkron WhatsApp şablonu |
| **NotificationSink** | Slack/Teams webhook hedefi |
| **SocialMonitorRule** | Sosyal medya arama-sorgu izleme kuralı |
| **IvrCall** | IVR çağrı kaydı (transkript, kayıt, ticket linki) |

### Enum'lar
- **ChannelType:** WHATSAPP, WEB_CHAT, CITIZEN_WEB, MOBILE_APP, OPERATOR, INSTAGRAM, FACEBOOK, SMS, EMAIL, TELEGRAM, TWITTER
- **TicketStatus:** NEW, TRIAGED, ASSIGNED, IN_PROGRESS, WAITING_INFO, RESOLVED, CLOSED, REJECTED
- **TicketPriority:** LOW, NORMAL, HIGH, URGENT
- **MessageVisibility:** PUBLIC, INTERNAL
- **UserRole:** SUPER_ADMIN, TENANT_ADMIN, MANAGER, DEPARTMENT_STAFF, OPERATOR, READ_ONLY
- **AuditActorType:** USER, CITIZEN, AI, SYSTEM, WEBHOOK
- **CitizenIdentifierKind:** PHONE, EMAIL
- **CitizenIdentifierSource:** PUBLIC_WEB, WEB_CHAT, WHATSAPP, INSTAGRAM, FACEBOOK, SMS, EMAIL, STAFF, IMPORT, MERGE
- **OutboundDeliveryState:** PENDING, DISPATCHED, DELIVERED, FAILED, SKIPPED
- **AttachmentScanStatus:** PENDING, CLEAN, INFECTED, ERROR, SKIPPED

---

## 5. Backend (API) Modülleri

`apps/api/src/modules/` — **26 modül**.

### Çekirdek Ticketing & AI
- **tickets** — Servis masası çekirdeği (en büyük modül). Liste/cursor sayfalama, oluşturma, atama, durum geçişleri, internal not / public mesaj, toplu atama/durum (maks 50), SSE olay akışı, etiket/takipçi/kontrol-listesi, WhatsApp handoff'tan ticket oluşturma, duplicate işaretleme. AI uçları: `suggest-reply`, `summarize`, `evaluate-follow-up`, `analyze-sentiment`, `suggest-priority`, `smart-assign`. Destek servisleri: SLA hesabı, ticket no, bildirim kuyruğu, CSAT kuyruğu, geocode kuyruğu, FCM push.
- **semantic** — Duplicate tespiti (OpenAI embedding + cosine >0.85; fallback Claude Haiku).

### Kimlik & RBAC
- **auth** — Personel girişi (bcrypt + opsiyonel TOTP), JWT access(15dk)/refresh(7g) rotasyonu, logout (jti revoke, Redis blacklist), parola sıfırlama (1s, enumeration-safe), `GET /auth/me`, TOTP setup/enable/disable.
- (public içinde) **Firebase vatandaş auth** + HMAC imzalı vatandaş session token (7g), KVKK self-servis silme.

### Public / Vatandaş (public modülü — 11 controller)
- Ticket oluşturma (AI sınıflandırma → takip kodu), takip, mesaj, escalate, timeline.
- Conversation başlatma/mesaj; widget ayarları/durum; cihaz token; transparency stats.
- `widget.js` gömülebilir script; FAQ + randevu; attachment yükleme/onay/indirme.
- Gelen webhook'lar: Postmark (e-posta), Telegram. Internal channel-ingest (servisler arası, `x-kentos-internal-key`).
- **AI intake** kiracı bazlı **bütçe koruması** (`ai-cost-guard`) ile; her çağrı `AiRun`'a yazılır; deterministik fallback.

### Kiracı Yönetimi
- **tenants** — departman/kategori/SLA/şablon/widget/saklama/AI-bütçe ayarları (okuma + admin mutasyon).
- **admin** — Platform süper-admin (kiracı CRUD + seed).
- **users** — Personel yönetimi.
- **citizens** — Vatandaş kayıtları + KVKK (merge, anonimleştir, dışa aktar).

### Kanallar & Bildirim
- **channels** — WhatsApp şablonları, bildirim sink'leri (Slack/Teams).
- **ivr** — Twilio Voice (TwiML, kayıt transkripsiyon → ticket).
- **social-monitor** — Twitter/X arama API izleme.
- **mail** — Transactional e-posta (controller yok).
- **canned-replies**, **ticket-tags** — Hazır yanıt & etiket yönetimi.

### Gerçek Zaman, Analitik, Raporlama
- **events** — SSE olay otobüsü (ticket/sla/delivery olayları, 15s heartbeat); internal emit.
- **presence** — Operatör online heartbeat / liste.
- **analytics** — Dashboard verileri (overview, departman/kategori/mahalle/kanal, conversation segment, AI usage, outbound, CSAT, operatör, SLA trend, ısı haritası).
- **reports** — Async rapor üretimi (kuyruk), CSV export (maks 10k), abonelikler.
- **digest** — AI haftalık özet (BullMQ tekrarlı iş).
- **faq**, **appointments** — Bilgi bankası & randevu yönetimi.
- **attachments** — Presigned S3 yükleme, karantina (INFECTED), indirme, yeniden tarama.
- **edevlet** — TC Kimlik No doğrulama (e-Devlet KPS SOAP; yapılandırılmazsa stub).
- **health** — `/health`, `/health/ready` (DB+Redis+ClamAV), `/health/metrics` (Prometheus).
- **prisma** — Paylaşılan DB istemcisi.

---

## 6. Vatandaş Portalı (citizen-web)

Next.js App Router. Çoğu rota `app/[tenantSlug]/` altında. Türkçe arayüz.

| Rota | İşlev |
|------|-------|
| `/` | Ana sayfa/landing; hızlı-örnek promptlar, asistan önizleme formu |
| `/privacy-policy` | Gizlilik Politikası (statik) |
| `/data-deletion` | KVKK veri silme talimatları |
| `/widget.js` | Gömülebilir widget yükleyici script (force-static) |
| `/widget/[tenantSlug]` | Canlı widget önizleme / sohbet kabuğu (AI intake) |
| `/[tenantSlug]` | Tenant girişi → `/report`'a yönlendirir |
| `/[tenantSlug]/report` | **Başvuru formu** (açıklama, adres, konum seçici, ad, telefon, e-posta, dosya) → takip kodu |
| `/[tenantSlug]/track` | Takip kodu girişi (gizli TK kodu) |
| `/[tenantSlug]/ticket/[trackingToken]` | **Public ticket durum sayfası** (durum, birim, öncelik, ekler+tarama etiketi, public zaman çizelgesi) |
| `/[tenantSlug]/faq` + `/faq/[slug]` | **Bilgi Bankası** (dil filtresi tr/en/ku/ar) + makale detayı |
| `/[tenantSlug]/appointments` | **E-Randevu** (slot seçimi + rezervasyon, randevu kodu) |
| `/[tenantSlug]/account` | Hesabım + **KVKK veri silme** |
| `/[tenantSlug]/login` | Firebase vatandaş girişi (Google/telefon) |

**Server Actions:** `createReportAction`, `trackTicketAction`, `bookAppointmentAction`, `submitWidgetMessage`. **Route handler'lar:** widget.js, login/set-session (httpOnly cookie), account/erasure.
PWA destekli (manifest + service worker).

---

## 7. Yönetim Paneli (admin-web)

Next.js App Router. Sidebar: `admin-shell.tsx`. httpOnly JWT cookie oturumu, RBAC gated.

| Rota | İşlev |
|------|-------|
| `/` | **Dashboard** — KPI kartları (açık kuyruk, SLA ihlal/yaklaşan, bugün çözülen, CSAT), öncelikli kuyruk |
| `/tickets` | **Talepler** — filtreli liste (arama, durum, birim, kategori, atanan) |
| `/tickets/[id]` | **Talep detayı** — durum/atama, **AI intake özeti**, mesajlar, hızlı aksiyon, **AI yanıt önerisi**, denetim izi, canlı yenileme |
| `/handoffs` + `/handoffs/[id]` | **Operatör devri** — insan desteği bekleyen sohbetler; handoff'tan ticket oluşturma |
| `/queues` | **Birim kuyrukları** — departman SLA iş yükü |
| `/reports` | **Raporlar** (manager) — KPI, conversation segment, **AI kullanım & maliyet**, outbound teslimat, CSAT, operatör performansı, rapor üretimi |
| `/users` | **Kullanıcı yönetimi** (filtre, oluştur) |
| `/citizens` + `/citizens/[id]` | **Vatandaş kayıtları (KVKK)** — arama, anonimleştir, **veri dışa aktar (JSON)** |
| `/canned-replies` | **Hazır yanıtlar** (paylaşılan/kişisel) |
| `/ticket-tags` | **Etiketler** (ad + renk) |
| `/faq` | **Bilgi Bankası yönetimi** (oluştur, yayın-toggle, dil) |
| `/appointments` | **Randevu yönetimi** — Randevular + Slotlar sekmeleri |
| `/channels` | **Kanal ayarları** — Slack/Teams sink; Postmark/Telegram inbound uçları |
| `/social-monitor` | **Sosyal medya izleme (X)** — kural CRUD, manuel tara |
| `/ivr` | **IVR çağrı kayıtları** (Twilio + Whisper) |
| `/settings` | **Tenant config** — widget kurulum, KVKK saklama, AI bütçe, departman/kategori/SLA CRUD, personel, mesaj şablonları |
| `/login`, `/login/forgot-password`, `/auth/reset-password` | Admin giriş & parola sıfırlama |
| `/api/events/stream` | SSE proxy (token sunucuda kalır) |

---

## 8. Worker (Arka Plan İşleri)

BullMQ; 9 kuyruk + DLQ. Health HTTP portu 3130 (>100 failed → 503). Prefix `kentos.`:

| Kuyruk | İş |
|--------|-----|
| `sla` | SLA ihlallerini kalıcılaştır + atanmamış ihlalleri MANAGER'a eskale |
| `notifications` | Public ticket mesajında vatandaşa giden teslimat enqueue |
| `media` | **Attachment virüs tarama** (ClamAV); INFECTED karantina |
| `retention` | **KVKK veri saklama/silme** (günlük 03:00 UTC; `RETENTION_DRY_RUN` korumalı) |
| `outbound` | **Giden mesaj teslimi** gateway'e; Meta WhatsApp **24-saat penceresi / HSM şablon** kuralı |
| `webhooks` | Kiracı webhook teslimi (HMAC imza + **SSRF koruması**) |
| `csat` | RESOLVED ticket'larda **CSAT anketi** gönderimi |
| `geocode` | **Reverse geocoding** (OpenStreetMap Nominatim) |
| `digest` | **Haftalık yönetici özeti** e-postası (Postmark) |
| `dlq` | Retry tükeninen işler için ölü mektup kuyruğu |

---

## 9. WhatsApp Gateway

Plain Node HTTP (port 3120). Çok kanallı gelen/giden geçit.

**Gelen webhook'lar (imza doğrulamalı):**
- WhatsApp (Meta Cloud / Baileys) — `GET/POST /webhooks/whatsapp`
- Instagram DM — `/webhooks/instagram`; Facebook Messenger — `/webhooks/facebook`
- E-posta (Postmark inbound) — `/webhooks/email`; SMS (Twilio) — `/webhooks/sms`

**Giden (internal, `x-kentos-internal-key`):** `/internal/{whatsapp,instagram,facebook,sms,email}/outbound` — her kanalda `*_OUTBOUND_LIVE` bayrağı (yoksa DRY-RUN). `GET /health`.

Gelen mesajlar `ChannelIntakeEnvelope`'a normalize edilip API'ye iletilir. (Telegram inbound API tarafında işlenir.)

---

## 10. Paylaşılan Paketler

- **`@kentos/shared`** — Domain tipleri & enum'lar, AI intake tipleri, `ChannelIntakeEnvelope`/`OutboundEnvelope`, Zod şemaları (`trackingTokenSchema` = `TK-[A-F0-9]{16}`), deterministik intake fallback, vatandaş contact normalize, WhatsApp provider arayüzleri, **PII maskeleme** (`maskPhone/Email/NationalId`), saklama sabitleri.
- **`@kentos/database`** — Prisma veri katmanı; `PrismaClient` + enum re-export, `schema.prisma` (34 model), `seed.ts` (bcryptjs).

> `packages/config` **yoktur** (config admin-web içinde app-seviyesi koddur).

---

## 11. Güvenlik & KVKK Katmanı

**Guard'lar (`common/guards/`):**
- `roles.guard` — `@Roles()` RBAC kontrolü.
- `public-channel.guard` — widget **origin allowlist** + Redis sliding-window rate limit.
- `tenant-throttle.guard` — kiracı bazlı rate limit (varsayılan 300/60s; Redis düşerse fail-open).
- `throttler-with-headers.guard` — `X-RateLimit-*` + `Retry-After` başlıkları.
- `ip-allowlist.guard` — kiracı IP allowlist (FAZ 1).
- `jwt-blacklist.guard` — Redis tabanlı token iptali (jti).

**Interceptor:** `pii-mask.interceptor` — **KVKK Madde 6**: çıkışta 11 haneli TC No maskeler (`123****4`).
**Filter:** `AllExceptionsFilter` — global; stack sızdırmaz, `requestId` döner, Sentry capture.
**Decorator'lar:** `@Roles(...)`, `@CurrentUser()`.

**KVKK özellikleri:** onay versiyonlama, self-servis erasure, anonimleştirme, veri dışa aktarma, kiracı bazlı veri saklama/silme (worker retention).

---

## 12. AI Özellik Haritası

| Özellik | Konum | Sağlayıcı | Fallback |
|---------|-------|-----------|----------|
| Intake sınıflandırma & yönlendirme | `public/public-ticket.service` | Anthropic/OpenAI | Deterministik (`intake-deterministic`) |
| Yanıt önerisi, özetleme, duygu analizi, takip değerlendirme, öncelik önerisi, akıllı atama | `tickets/ticket-ai.service` | Claude (varsayılan `claude-haiku-4-5`, prompt cache) | Deterministik |
| Duplicate tespiti | `semantic/semantic-duplicate.service` | OpenAI embedding + cosine | Claude Haiku |
| Haftalık AI özeti | `digest` modülü | Claude | — |
| IVR transkripsiyon | `ivr/ivr.service` | OpenAI Whisper | — |

Her AI çağrısı `AiRun`'a (token/maliyet) yazılır; kiracı bazlı **AI bütçe koruması** günlük token/maliyet sınırı aşılınca deterministik fallback'e düşer.

---

## 13. Portlar & Çalıştırma

| Servis | Port |
|--------|------|
| API | 3100 |
| admin-web | 3101 |
| citizen-web | 3102 |
| whatsapp-gateway | 3120 |
| worker health | 3130 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO (API/UI) | 9000 / 9001 |
| ClamAV | 3310 |

**Çalıştırma:**
```bash
pnpm install
pnpm db:generate && pnpm db:deploy && pnpm db:seed
pnpm dev                       # tüm uygulamalar paralel
# veya tekil:
pnpm --filter @kentos/api dev          # 3100
pnpm --filter admin-web dev            # 3101
pnpm --filter citizen-web dev          # 3102
pnpm --filter @kentos/whatsapp-gateway dev  # 3120
pnpm --filter @kentos/worker dev       # arka plan
```

**Demo veri (seed):** tenant `demo-belediye`, admin `admin@demo.local` / `ChangeMe123!`, 27 departman, 23 kategori, mesaj şablonları.

> ⚠️ **Önemli operasyon notu:** Şemaya yeni model eklendiğinde `pnpm db:generate` çalıştırıp **API'yi yeniden başlatın**. Bayat Prisma client, yeni modellere giden uçlarda 500 hatasına yol açar (`tsx watch` `node_modules`'ü otomatik reload etmez).
