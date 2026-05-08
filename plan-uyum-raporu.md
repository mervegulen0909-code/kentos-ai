# KentOS AI — Plan ↔ Uygulama Uyum Raporu

Tarih: 2026-05-07
Kaynak plan: `plan.md`

Aşağıdaki rapor, `plan.md` içindeki dokuz fazın ve "İlk Uygulama Dalgası" hedeflerinin mevcut kod tabanında ne ölçüde uygulanmış olduğunu gösterir. Her faz için durum: ✅ uygulanmış · 🟡 kısmen uygulanmış · ❌ uygulanmamış.

## Özet tablo

| Faz | Konu | Durum |
| --- | --- | --- |
| Faz 0 | Mimari sabitleme (Conversation, ChannelEvent, envelope) | ✅ |
| Faz 1 | Web Widget MVP (script, iframe, public API) | ✅ |
| Faz 2 | Sohbet tabanlı intake (AI follow-up, ticket, takip kodu) | ✅ |
| Faz 3 | Ortak kanal omurgası (envelope, internal/channel-ingest) | ✅ |
| Faz 4 | WhatsApp ürünleşmesi (gateway → forwarder → API) | 🟡 |
| Faz 5 | Admin analitik (kanal, otomasyon, handoff) | 🟡 |
| Faz 6 | Tenant self-serve kurulum (settings sayfası) | ✅ |
| Faz 7 | Gelişmiş kanallar (Instagram/Facebook/SMS) | ❌ |
| Faz 8 | Güvenlik / KVKK (origin allowlist, rate limit) | 🟡 |
| Faz 9 | Test ve release (Playwright e2e seti) | 🟡 |

## Faz 0 — Mimari sabitleme — ✅

Plan kapsamı: ortak conversation modeli, kanal mimarisi, embed güvenlik yaklaşımı, analytics standardı.

Bulgular:

- `packages/database/prisma/schema.prisma` içinde `Conversation`, `ChannelEvent`, `AuditLog` ve `AiRun` modelleri var (sırasıyla satır 363, 383, 399, 420).
- `ChannelType` enum'u `WHATSAPP, WEB_CHAT, CITIZEN_WEB, MOBILE_APP, OPERATOR` değerlerini içeriyor.
- `@kentos/shared` paketinde `ChannelIntakeEnvelope`, `IntakeChannel`, `NormalizedInboundMessage` tipleri tanımlı (apps/api ve gateway'den ortak referansla kullanılıyor).
- Tenant tarafında `widgetEnabled`, `widgetTitle`, `widgetWelcome`, `widgetAllowedOrigins` alanları mevcut.

Sonuç: Conversation/session veri modeli, kanal envelope sözleşmesi ve embed güvenliğinin temel veri katmanı sabitlenmiş.

## Faz 1 — Web Widget MVP — ✅

Plan kapsamı: tek script ile gömülebilen widget, tenant slug ile bootstrap, sohbet UI, public API entegrasyonu.

Bulgular:

- Bootstrap script: `apps/citizen-web/app/widget.js/route.ts` — `data-tenant`, `data-label` parametrelerini okuyup launcher butonu ve iframe (z-index 2147483645/6) enjekte ediyor; iframe `/widget/<tenantSlug>` adresine yükleniyor.
- Widget iframe sayfası: `apps/citizen-web/app/widget/[tenantSlug]/page.tsx` — sunucu tarafında `citizenApi.getWidgetSettings(...)` çağrısı yapılıyor, `WidgetChatForm` ile sohbet kabuğu render ediliyor.
- Tenant ayar API'si: `apps/api/src/modules/public/public-widget.controller.ts` ve `public-conversation.service.ts > widgetSettings(...)`.
- Görsel: `widget-preview-shell`, `widget-chat-card`, `widget-message-list` global CSS sınıfları admin/citizen `globals.css`'te tanımlı.

Sonuç: Embeddable widget, yalın bir `<script src="/widget.js" data-tenant=...>` ile çalışacak biçimde çıkarılmış.

## Faz 2 — Sohbet tabanlı intake — ✅

Plan kapsamı: serbest metin başlangıcı, AI follow-up, ticket oluşturma, takip kodu, mevcut form akışının korunması.

Bulgular:

- Conversation API: `apps/api/src/modules/public/public-conversation.controller.ts` ve `public-conversation.service.ts`.
- `processMessage(...)` akışı:
  - `PublicTicketAiService.classify` çağrılıyor;
  - eksik alan varsa `followUpQuestion` döndürülüyor (`missingFields.length`);
  - intent `new_ticket` ve eksik alan yoksa `tickets.create(...)` ile ticket açılıyor;
  - context'e `trackingToken` yazılıyor ve assistant mesajı olarak vatandaşa gösteriliyor;
  - intent `human_handoff` ise `handoffRequested = true` set ediliyor.
- Mevcut form akışı `apps/citizen-web/app/[tenantSlug]/report/page.tsx` üzerinde korunmaya devam ediyor.

Sonuç: Vatandaş yalnızca sohbet ederek ticket açabiliyor; takip kodu konuşma içinde gösteriliyor.

## Faz 3 — Ortak kanal omurgası — ✅

Plan kapsamı: kanal bağımsız message envelope, normalize edilmiş intake, audit/`ChannelEvent`.

Bulgular:

- `channelIntakeEnvelopeSchema` (zod) `@kentos/shared`'da tanımlı.
- WhatsApp gateway → API normalleştirme: `apps/whatsapp-gateway/src/intake-forwarder.ts > toChannelIntakeEnvelope(...)` ve `forwardInboundMessages(...)` POST → `/internal/channel-ingest`.
- Internal endpoint: `apps/api/src/modules/public/internal-channel.controller.ts` — `x-kentos-internal-key` header doğrulaması yapıyor, `PublicConversationService.ingestEnvelope(...)` çağırıyor.
- `ingestEnvelope` aynı `processMessage` akışını yeniden kullanarak idempotent çalışıyor (`recordInboundEvent` + `ChannelEvent` upsert benzeri davranış).

Sonuç: Web widget ve WhatsApp aynı intake çekirdeğine bağlanmış.

## Faz 4 — WhatsApp ürünleşmesi — 🟡

Plan kapsamı: inbound mesaj akışı, follow-up sorma, ticket dönüşü, operatör devri, tenant template yönetimi.

Bulgular:

- ✅ Inbound: `BaileysProvider` ve `MetaCloudProvider` (apps/whatsapp-gateway/src/providers/) + `handleWebhook` main.ts.
- ✅ Follow-up sorgusu intake hattından otomatik geliyor.
- ✅ Ticket açılışı + takip kodu intake'e bağlı.
- 🟡 Outbound (gateway tarafından vatandaşa cevap gönderme) `forwardInboundMessages` üzerinde değil; ingestEnvelope cevabı dönüyor ama bu cevabı WhatsApp üzerinden geri yollayacak bir outbound dispatcher gözükmüyor.
- ❌ WhatsApp template/bilgilendirme mesajı tenant bazlı yönetimi (Faz 4 maddesi) ayrı bir modül olarak yok; mesaj şablonları `MessageTemplate` modeli üzerinde duruyor ama WhatsApp template ID/HSM eşlemesi henüz yok.

Sonuç: Inbound çekirdek hazır, outbound + template yönetimi tamamlanmamış. "Vatandaş yazıp ticket açabilmeli ve takip kodu alabilmeli" çıkış kriterini karşılamak için outbound delivery tamamlanmalı.

## Faz 5 — Admin analitik — 🟡

Plan kapsamı: kanal bazlı dashboard, otomasyon oranı, follow-up başarı, insan devri, SLA görünürlüğü.

Bulgular:

- ✅ Backend `AnalyticsService.channels(...)` (apps/api/src/modules/analytics/analytics.service.ts) kanal bazında ticket, conversation, AI mesaj ve public mesaj sayılarını + `automationRate` döndürüyor.
- ✅ `handoffs` endpoint'i ve `/handoffs` admin sayfası mevcut (insan devri görünürlüğü).
- ✅ SLA metrikleri (`slaBreached`, `slaDueSoon`) overview'da var.
- 🟡 `/reports` sayfası (`apps/admin-web/app/reports/page.tsx`) yalnızca toplam KPI'leri ve `byStatus` dağılımını gösteriyor; **kanal bazlı kart yok** (Grep `channel|kanal` → 0 eşleşme). `automationRate` UI'a hiç bağlanmamış.
- 🟡 "AI tamamladı / operatöre düştü / eksik bilgi bekliyor" segment kartları henüz yok.

Sonuç: Analytics motoru kanal verisini üretebiliyor ama admin UI bu veriyi henüz görselleştirmiyor — Faz 5'in arka ucu hazır, ön ucu eksik.

## Faz 6 — Tenant self-serve kurulum — ✅

Plan kapsamı: admin panelinden widget kurulum ekranı, script üretimi, ayarlar, doğrulama.

Bulgular:

- `apps/admin-web/app/settings/page.tsx` içinde "Belediye sitesine tek script ile ekle" kartı:
  - `<script src="/widget.js" data-tenant="..." data-label="..." async></script>` snippet'i otomatik üretiliyor.
  - Tenant slug, script path, önizleme link, beklenen kanal ve durum kontrol listesi gösteriliyor.
  - `updateWidgetSettingsAction` ile widget durumu, başlık, karşılama metni ve **origin allowlist** kaydedilebiliyor.
- E2E doğrulaması: `tests/e2e/admin-widget-install.spec.ts` install snippet ve önizleme akışını kontrol ediyor.

Sonuç: Faz 6'nın çıkış kriteri (teknik ekip panelden kodu alıp siteye ekleyebilmeli) karşılanıyor. Tek eksik: "kurulum durumu / bağlantı testi" canlı diagnostik (heartbeat) — UI'da statik göstergeler var, otomatik origin doğrulaması yok.

## Faz 7 — Gelişmiş kanallar ve operatör devri — ❌

Plan kapsamı: Instagram/Facebook DM adaptörü, SMS fallback, operatör giriş ekranı, canlı devir kuralları.

Bulgular:

- `ChannelType` enum'unda Instagram/Facebook/SMS yok (sadece `WHATSAPP, WEB_CHAT, CITIZEN_WEB, MOBILE_APP, OPERATOR`).
- Admin UI'da `INSTAGRAM`, `FACEBOOK`, `SMS`, `EMAIL`, `PHONE` etiketleri `handoffs/page.tsx` içinde sadece görsel hazırlık olarak var; backend tarafında bu kanalları üreten adapter yok.
- 🟡 Handoff sayfası ve ticket detay sayfası operatör devri akışına bir miktar zemin sağlıyor ama dedicated "operator console" giriş ekranı yok.

Sonuç: Plan'ın da öngördüğü gibi en sona bırakılmış faz; henüz başlanmamış.

## Faz 8 — Güvenlik / KVKK / üretim sertleştirme — 🟡

Plan kapsamı: tenant izolasyonu, origin kontrolü, abuse koruması, PII sınırları, audit sertleştirme.

Bulgular:

- ✅ Origin allowlist: `PublicChannelGuard` (apps/api/src/common/guards/public-channel.guard.ts) tenant `widgetAllowedOrigins` + env `WIDGET_ORIGIN_ALLOWLIST` üzerinden çalışıyor; production'da boş allowlist 403 atıyor.
- ✅ Public rate limit: in-memory bucket, `PUBLIC_RATE_LIMIT_MAX` (varsayılan 120) ve `PUBLIC_RATE_LIMIT_WINDOW_MS` (varsayılan 60_000) ile.
- ✅ Internal endpoint koruma: `INTERNAL_API_KEY` zorunlu, production'da `change-me-internal` reddediliyor.
- ✅ KVKK kontrol listesi dokümanı: `docs/checklists/security-kvkk.md`.
- 🟡 Rate limit in-memory; çok-instance ortamda Redis/BullMQ tabanlı bir koruma henüz yok.
- 🟡 PII masking ve retention politikaları kod tarafında zorlanmıyor (yalnızca dokümante edilmiş).
- 🟡 Audit sertleştirme: `AuditLog` modeli var, mutation kapsamının "anlamlı seviyede" genişliği bu raporda incelenmedi.

Sonuç: Temel güvenlik kontrolleri mevcut, KVKK ve retention katmanları doküman seviyesinde duruyor.

## Faz 9 — Test, demo ve release — 🟡

Plan kapsamı: widget E2E, chat intake testi, WhatsApp smoke, demo senaryoları, release dokümantasyonu.

Bulgular:

- ✅ Playwright e2e testleri: `tests/e2e/admin-login.spec.ts`, `admin-widget-install.spec.ts`, `citizen-report.spec.ts`, `citizen-track.spec.ts`, `citizen-widget.spec.ts`.
- ✅ Widget intake spec'i: `citizen-widget.spec.ts` "Internal Server Error / Prisma / Exception" sızıntısı yok kontrolü ve takip kodu beklentisi içeriyor.
- ✅ Smoke API: `scripts/smoke-api.mjs` (kök package.json'da `pnpm smoke:api`).
- ✅ Release dokümanı: `docs/releases/RELEASE_NOTES.md`, `docs/checklists/release-checklist.md`.
- 🟡 WhatsApp uçtan uca smoke'u görünmüyor (gateway için unit test yok bu seviyede).
- 🟡 "Belediye demo senaryoları" başlığı altındaki tenant demo veri seti README/seed seviyesinde — ayrı bir scripti yok.

Sonuç: Web tarafında test yatırımı ciddi; WhatsApp smoke ve demo senaryosu olgunlaştırılması gereken alanlar.

## "İlk Uygulama Dalgası" (Faz 0+1+2) durumu — ✅ tamamlandı

Plan, ilk geliştirme dalgasında yalnızca Faz 0, 1, 2'yi alır ve şu çıktıları hedefler:

1. belediye sitesine gömülebilen asistan,
2. vatandaşın sohbet ederek başvuru açabilmesi,
3. mevcut ticket omurgasının yeniden kullanılması,
4. PDF'deki ürün hissine yaklaşan ilk görünür deneyim.

Bu dört madde de mevcut kodda karşılanıyor: `widget.js` route, `/widget/[tenantSlug]` iframe, `PublicConversationService.processMessage`, `tickets.create`, `trackingToken` döngüsü ve admin panelden alınabilen embed snippet'i.

## Eksik / takip edilmesi gereken işler

| Öncelik | İş | Faz |
| --- | --- | --- |
| Yüksek | WhatsApp outbound delivery: ingestEnvelope sonucu vatandaşa gateway üzerinden geri yollama | 4 |
| Yüksek | `/reports` sayfasına kanal bazlı kart + automationRate + handoff oranı | 5 |
| Orta | "AI tamamladı / operatöre düştü / eksik bilgi" segment görünümü | 5 |
| Orta | Widget kurulum doğrulama heartbeat (origin/script load probu) | 6 |
| Orta | WhatsApp template/HSM tenant ayarı | 4 |
| Düşük | Instagram/Facebook DM/SMS adapter sözleşmesi | 7 |
| Düşük | Multi-instance rate limit (Redis bucket) | 8 |
| Düşük | PII masking/retention enforcement (kod katmanı) | 8 |
| Düşük | WhatsApp e2e smoke ve seed-driven demo tenant senaryosu | 9 |

## Genel sonuç

İlk üç faz (0–2) ürünleşmiş; Faz 3 ve Faz 6 da uygulanmış durumda. Faz 4 ve Faz 5 mimari olarak hazır ama UI/outbound katmanı eksik. Faz 7 henüz başlamamış. Faz 8 ve Faz 9 temel seviyede karşılanıyor; üretim sertleştirme ve demo olgunluğu için ek yatırım gerekiyor.

Plan'ın söz verdiği "PDF'deki ürün hissine yaklaşan ilk görünür deneyim" bugün itibariyle çalışır durumda; "tam çok kanallı belediye operasyon ürünü" hedefi için yukarıdaki takip listesinin yüksek-öncelik kalemleri gerekli.
