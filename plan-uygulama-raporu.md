# KentOS AI — Plan Eksiklerinin Tamamlanması Raporu

Tarih: 2026-05-07
Kaynak plan: `plan.md`
Önceki durum analizi: `plan-uyum-raporu.md`

Bu rapor, plan-uyum-raporu.md'de listelenen eksiklerin altı slice halinde tamamlanmasını özetler.

## Slice A — Faz 5 Reports UI tamamlandı

- `apps/api/src/modules/analytics/analytics.service.ts` içine **`conversationSegments(...)`** metodu eklendi: AI tamamladı, operatöre düştü, eksik bilgi bekliyor segment metrikleri ve kümülatif `automationRate` döndürür.
- `apps/api/src/modules/analytics/analytics.controller.ts` içine `/analytics/conversation-segments` endpoint'i.
- `apps/admin-web/lib/api.ts` içine `AnalyticsConversationSegments` tipi ve `conversationSegments(...)` client metodu.
- `apps/admin-web/app/reports/page.tsx` artık üç bölüm gösteriyor:
  1. **Konuşma segmentleri**: AI tamamladı / Operatöre düştü / Eksik bilgi / Otomasyon oranı kartları.
  2. **Kanal performansı**: ticket, konuşma, mesaj ve kanal başına otomasyon oranı listesi.
  3. **Durum dağılımı**: önceki davranış korunmuş.

## Slice B — Faz 4 WhatsApp outbound altyapısı

- `packages/database/prisma/schema.prisma`:
  - `OutboundDeliveryState` enum'u (`PENDING / DISPATCHED / DELIVERED / FAILED / SKIPPED`).
  - Yeni `OutboundDelivery` modeli (tenant, kanal, recipient, body, attempts, lastError, dispatchedAt, deliveredAt).
  - `Tenant.outboundDeliveries` relation eklendi.
- `packages/shared/src/schemas.ts` + `types.ts`: `channelOutboundEnvelopeSchema` ve `ChannelOutboundEnvelope` tipi.
- API:
  - `apps/api/src/modules/public/outbound-dispatch.service.ts` — `OutboundDispatchService`. Asistan cevabı üretildiğinde delivery kaydı yaratır, in-process kanallarda `SKIPPED` olarak işaretler, dış kanallarda gateway URL'sine HTTP POST yapar (env yoksa `PENDING` kalır).
  - `PublicConversationService.processMessage(...)` artık her assistantMessage sonrası `outbound.dispatch(...)` çağırıyor.
  - `PublicTicketModule` provider listesi güncellendi.
- Gateway:
  - `apps/whatsapp-gateway/src/outbound-handler.ts` — `handleWhatsAppOutbound(...)`: envelope doğrulama, internal key kontrolü, default **dry-run** + log; `WHATSAPP_OUTBOUND_LIVE=true` env flag ile gerçek `provider.sendText` çağrısı.
  - `main.ts`'e `handleOutbound(...)` exposed.
- Tenant message templates: `MessageTemplate.channel` alanı zaten Prisma'da vardı; admin UI'da kanal `<select>` (WHATSAPP / WEB_CHAT / SMS / INSTAGRAM / FACEBOOK / ...) eklendi.
- API DTO: `UpdateMessageTemplateDto` `channel?` alanı kabul ediyor.

## Slice C — Faz 6 Widget heartbeat

- `PublicWidgetController` artık iki endpoint sunuyor:
  - `GET /public/:tenantSlug/widget-settings` (eski).
  - `GET /public/:tenantSlug/widget-status` — tenant'ın `widgetEnabled` durumu, `widgetReady`, request origin'in allowlist'te olup olmadığı, allowlist boyutu ve kontrol zamanı.
- Admin Settings sayfası: yeni client component `WidgetStatusProbe` "Bağlantıyı test et" butonu sunar, opsiyonel test origin alır, sonucu inline gösterir.

## Slice D — Faz 8 Üretim sertleştirme

- **Redis tabanlı rate limit**: `apps/api/src/common/services/rate-limit.service.ts` — `Redis.incr` + `pexpire` üzerinden çoklu instance güvenli bucket; Redis erişilemediğinde 30 sn süreyle in-memory fallback.
- `PublicChannelGuard.requireRateLimit(...)` artık `RateLimitService.hit(...)` kullanıyor.
- `RateLimitService`, `PublicTicketModule` provider listesinde.
- **PII masking**: `packages/shared/src/pii-masking.ts` — `maskPhone`, `maskEmail`, `maskNationalId`, `maskPii`, `maskPiiInRecord`, `safeLogString` helper'ları. `index.ts` export'una eklendi.
- **Retention scheduled job iskeleti**: `apps/worker/src/queues/queue-names.ts` içine `retention: 'kentos.retention'`. Yeni `retention.processor.ts` job veri sözleşmesini (`tenantId, retentionDays, scope`) tanır ve cutoff tarihi raporlar; gerçek silme işlemi bir sonraki worker dalgasında Prisma ile bağlanacak (kod yorumda belirtildi).
- `worker/src/main.ts` retention worker'ı kayıt eder.

## Slice E — Faz 9 Test + demo seed

- `packages/database/prisma/seed.ts` artık demo tenant için 7 farklı conversation+channelEvent satırı oluşturuyor (WEB_CHAT × 2, WHATSAPP × 2, INSTAGRAM, FACEBOOK, SMS) — Reports sayfasındaki kanal kartı/segment kartları seed sonrasında dolu görünür.
- WhatsApp gateway test komutu: `tsx --test src/__tests__/*.test.ts`.
- Yeni testler:
  - `apps/whatsapp-gateway/src/__tests__/intake-forwarder.test.ts` — envelope normalize edilmesi, boş metin atlanması.
  - `apps/whatsapp-gateway/src/__tests__/outbound-handler.test.ts` — internal key reddi, dry-run davranışı, live send senaryosu, eksik recipient reddi.
- `package.json`'a `tsx` ve `typescript` devDeps eklendi.

## Slice F — Faz 7 Gelişmiş kanallar (Instagram, Facebook DM, SMS)

- **Şema**: `ChannelType` enum'una `INSTAGRAM`, `FACEBOOK`, `SMS`. `CitizenIdentifierSource` enum'una aynı üç değer.
- **Migration**: `packages/database/prisma/migrations/20260507120000_multi_channel_outbound/migration.sql`:
  - Yeni enum değerleri (`ALTER TYPE ... ADD VALUE IF NOT EXISTS`).
  - `OutboundDeliveryState` enum'u.
  - `OutboundDelivery` tablosu + indexler + tenant FK.
- **Shared paket**:
  - `ChannelProvider` interface (channel, providerName, parseWebhook, sendText).
  - `GenericInboundMessage`, `GenericSendInput`, `GenericChannelKind` tipleri.
  - `SendMessageResult.provider` alanı `string`'e genişletildi.
  - `intakeChannelSchema` enum'una `INSTAGRAM`, `FACEBOOK`, `SMS`.
- **Provider'lar** (default dry-run, `*_OUTBOUND_LIVE=true` ile gerçek send):
  - `apps/whatsapp-gateway/src/providers/instagram.provider.ts` — Meta Graph Instagram DM (parse + send).
  - `apps/whatsapp-gateway/src/providers/facebook.provider.ts` — Meta Graph Messenger.
  - `apps/whatsapp-gateway/src/providers/sms.provider.ts` — Twilio SMS (form-urlencoded + Basic auth).
- **Generic dispatcher**: `apps/whatsapp-gateway/src/generic-channel.ts`:
  - `getGenericProvider`, `inboundToEnvelope`.
  - `forwardGenericInbound(channel, raw)` — webhook → envelope → API `/internal/channel-ingest`.
  - `handleGenericOutbound(channel, raw, key)` — internal key + envelope kontrolü + provider.sendText.
- **Gateway main**:
  - `handleChannelWebhook(channel, raw)` ve `handleChannelOutbound(channel, raw, key)` exposed.
- **Operatör konsol entry point**: Admin sidebar zaten `/handoffs` üzerinden operatör akışına bağlı; `handoffs/page.tsx` channel etiket sözlüğü güncellenip yeni kanallar eklendi.

## Üretim öncesi yapılacaklar

Kod hazır; deploy/dev çalıştırma için aşağıdaki yerel adımlar gerekli:

1. **Prisma migration uygula**:
   ```
   pnpm db:generate
   pnpm db:migrate
   ```
   Yeni migration `20260507120000_multi_channel_outbound` çalışınca `OutboundDelivery` tablosu ve enum değerleri DB'ye iner.
2. **Seed yenile**:
   ```
   pnpm db:seed
   ```
   Reports sayfası canlı kanal verileri ile dolar.
3. **Typecheck + build**:
   ```
   pnpm typecheck
   pnpm build
   ```
4. **Smoke**:
   ```
   pnpm smoke:api
   ```
5. **Gateway testleri**:
   ```
   pnpm --filter @kentos/whatsapp-gateway test
   ```
   `pnpm install` yeni `tsx`/`typescript` devDeps'leri çekecek.
6. **Env flag'leri** (üretimde):
   - `INTERNAL_API_KEY` — gateway ↔ API arası zorunlu.
   - `WHATSAPP_GATEWAY_OUTBOUND_URL`, `INSTAGRAM_GATEWAY_OUTBOUND_URL`, `FACEBOOK_GATEWAY_OUTBOUND_URL`, `SMS_GATEWAY_OUTBOUND_URL` (ya da ortak `CHANNEL_GATEWAY_BASE_URL`).
   - `*_OUTBOUND_LIVE=true` her kanal için gerçek send'i açar; varsayılan kapalı (dry-run + log).
   - `REDIS_URL` — Redis tabanlı rate limit aktivasyonu.
   - `WIDGET_ORIGIN_ALLOWLIST` veya tenant ayarı zaten var.
   - `INSTAGRAM_GRAPH_TOKEN`, `FACEBOOK_PAGE_TOKEN`, `TWILIO_ACCOUNT_SID/AUTH/FROM`.
   - `INSTAGRAM_DEFAULT_TENANT_ID`, `FACEBOOK_DEFAULT_TENANT_ID`, `SMS_DEFAULT_TENANT_ID` — provider, tenant'ı henüz başka bir kaynaktan eşleştirmediği için fallback olarak kullanır.

## Bilinen sınırlar / ileri turlar

- Outbound delivery retry/queue policy basit (single attempt). Üretimde BullMQ üzerinden retry + DLQ tavsiye edilir.
- Retention processor şu an iskelet; gerçek satır silme işlemi worker DB bağlantısı eklenince devreye alınacak.
- Instagram/Facebook/SMS webhook signature doğrulaması bu turda yok — gerçek `*_OUTBOUND_LIVE=true` öncesinde Meta `X-Hub-Signature-256` ve Twilio `X-Twilio-Signature` doğrulaması eklenmeli.
- Operatör konsolu ayrı bir tam-ekran UI olarak değil, mevcut `/handoffs` üzerinden sunuluyor; kanal performansı `/reports` sayfasında.
- WhatsApp HSM template ID/HSM rendering henüz yok (`MessageTemplate.channel` alanı template metnini kanala bağlamak için kullanılıyor).
- Workspace bash bu oturumda erişilebilir değildi; `pnpm db:generate / typecheck / build / smoke` doğrulaması kullanıcıdan beklenmektedir.

## Etkilenen dosyalar

Şema:
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20260507120000_multi_channel_outbound/migration.sql`
- `packages/database/prisma/seed.ts`

Shared:
- `packages/shared/src/types.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/whatsapp.ts`
- `packages/shared/src/pii-masking.ts` (yeni)
- `packages/shared/src/index.ts`

API (`apps/api`):
- `src/modules/analytics/analytics.service.ts`
- `src/modules/analytics/analytics.controller.ts`
- `src/modules/public/outbound-dispatch.service.ts` (yeni)
- `src/modules/public/public-conversation.service.ts`
- `src/modules/public/public-ticket.module.ts`
- `src/modules/public/public-widget.controller.ts`
- `src/modules/tenants/dto/message-template.dto.ts`
- `src/modules/tenants/tenants.service.ts`
- `src/common/services/rate-limit.service.ts` (yeni)
- `src/common/guards/public-channel.guard.ts`

Admin web (`apps/admin-web`):
- `app/reports/page.tsx`
- `app/settings/page.tsx`
- `app/settings/actions.ts`
- `app/settings/widget-status-probe.tsx` (yeni)
- `app/handoffs/page.tsx`
- `lib/api.ts`

Gateway (`apps/whatsapp-gateway`):
- `package.json`
- `src/main.ts`
- `src/outbound-handler.ts` (yeni)
- `src/generic-channel.ts` (yeni)
- `src/providers/instagram.provider.ts` (yeni)
- `src/providers/facebook.provider.ts` (yeni)
- `src/providers/sms.provider.ts` (yeni)
- `src/__tests__/intake-forwarder.test.ts` (yeni)
- `src/__tests__/outbound-handler.test.ts` (yeni)

Worker (`apps/worker`):
- `src/queues/queue-names.ts`
- `src/processors/retention.processor.ts` (yeni)
- `src/main.ts`
