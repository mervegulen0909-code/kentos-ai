# Statik Audit Notları — 2026-05-07

Cowork workspace bash kapalı olduğu için yapılan tüm değişiklikler dosya araçlarıyla baştan sona okunup hata olabilecek kalıplar düzeltildi.

## Yakalanıp düzeltilen hatalar

| # | Sorun | Dosya | Düzeltme |
| --- | --- | --- | --- |
| 1 | `OutboundDeliveryState` `@kentos/database` üzerinden import ediliyor ama paket index'i bu enum'u export etmiyordu | `packages/database/src/index.ts` | `OutboundDeliveryState`, `CitizenIdentifierKind`, `CitizenIdentifierSource` export listesine eklendi |
| 2 | Widget probe header `JS-fetch'ten Origin set edilemez` notu — kullanıcının girdiği değer hiç gönderilmiyordu | `widget-status-probe.tsx`, `public-widget.controller.ts` | Client `x-probe-origin` gönderiyor; controller bunu önceliklendirip allowlist sonucunu döndürüyor |
| 3 | `HeadersInit` tipine string atanması TS strict modda dar olabiliyor | `widget-status-probe.tsx` | Tip `Record<string, string>`'e indirgendi |
| 4 | `MessageTemplate.channel` set'te `as never` cast'i — Prisma generated type ile çakışıyordu | `tenants.service.ts` | Cast kaldırıldı, doğrudan değer set ediliyor |
| 5 | `CreatePublicTicketDto.channel` IsIn listesi sadece 3 kanal kabul ediyordu; conversation-driven ticket create'leri INSTAGRAM/FACEBOOK/SMS için sahte cast yapıyordu | `dto/create-public-ticket.dto.ts` | Tüm IntakeChannel değerleri eklendi |
| 6 | `identitySourceForChannel(...)` yeni kanalları PUBLIC_WEB'e fallback'liyordu — citizen identifier source enum'unda artık değerler var | `public-ticket.service.ts`, `public-conversation.service.ts` | INSTAGRAM/FACEBOOK/SMS için açık eşleme eklendi |
| 7 | API package'ı `ioredis`'i transitive olarak alıyor ama type'ları için explicit dep gerekiyor (RateLimitService) | `apps/api/package.json` | `ioredis: ^5.4.2` eklendi |
| 8 | seed.ts kanal demo verisinde `as never` cast — yeni `ChannelType` enum değerleri prisma client regenerate sonrası artık tanımlı | `packages/database/prisma/seed.ts` | `ChannelType.INSTAGRAM` vb. doğrudan kullanılıyor |
| 9 | Gateway test komutu `tsx --test` kullanıyordu ama path eskimiş — glob pattern Windows'ta sorun çıkarabilir | `apps/whatsapp-gateway/package.json` | Açık iki dosya path'i ile çağrı |
| 10 | Server `req.headers['x-...']` cast'leri dizi olabilecek başlıkları kapsamıyordu | `apps/whatsapp-gateway/src/server.ts` | `readHeader()` helper'ı eklendi (Array.isArray guard) |
| 11 | Worker outbound processor `attemptsMade?: number` parametresi createWorker tarafından ayarlanmıyordu | `apps/worker/src/processors/outbound.processor.ts` | Kullanılmayan field kaldırıldı |

## Statik olarak gözden geçirilen dosyalar

API (`apps/api/src`):
- `modules/analytics/analytics.service.ts` (`conversationSegments`, `channels`)
- `modules/analytics/analytics.controller.ts`
- `modules/public/outbound-dispatch.service.ts` (BullMQ + audit + tip imzaları)
- `modules/public/public-conversation.service.ts` (`processMessage` outbound integration + identitySourceForChannel)
- `modules/public/public-ticket.service.ts` (`identitySourceForChannel`)
- `modules/public/public-widget.controller.ts` (status endpoint + probe origin)
- `modules/public/public-ticket.module.ts` (provider listesi: RateLimit + Outbound + Channel guard)
- `modules/public/dto/create-public-ticket.dto.ts`
- `modules/tenants/dto/message-template.dto.ts`
- `modules/tenants/tenants.service.ts` (`updateMessageTemplate`)
- `common/services/rate-limit.service.ts`
- `common/guards/public-channel.guard.ts`

Admin web (`apps/admin-web`):
- `app/reports/page.tsx` (segment + kanal kartları)
- `app/settings/page.tsx` (template kanal select + WidgetStatusProbe integration)
- `app/settings/widget-status-probe.tsx` (probe header + tipler)
- `app/settings/actions.ts` (`updateTemplateAction` channel handling)
- `app/handoffs/page.tsx` (kanal etiketleri)
- `lib/api.ts` (`AnalyticsConversationSegments` tipi + `conversationSegments()` client)

Gateway (`apps/whatsapp-gateway`):
- `src/main.ts` (yeni handler exports)
- `src/server.ts` (HTTP router + signature wiring)
- `src/outbound-handler.ts` (WhatsApp outbound dry-run/live)
- `src/generic-channel.ts` (generic dispatcher + provider registry)
- `src/webhook-signatures.ts` (Meta + Twilio HMAC)
- `src/intake-forwarder.ts` (mevcut; sadece importu doğrulandı)
- `src/providers/instagram.provider.ts`
- `src/providers/facebook.provider.ts`
- `src/providers/sms.provider.ts`
- `src/__tests__/intake-forwarder.test.ts`
- `src/__tests__/outbound-handler.test.ts`
- `package.json` (test komutu + start)

Worker (`apps/worker`):
- `src/main.ts` (worker kayıtları)
- `src/queues/queue-names.ts`
- `src/processors/outbound.processor.ts` (BullMQ retry + Prisma)
- `src/processors/retention.processor.ts` (gerçek deleteMany scope'ları)
- `src/prisma-client.ts` (singleton helper)

Shared (`packages/shared`):
- `src/types.ts` (ChannelType, IntakeChannel, ChannelOutboundEnvelope)
- `src/schemas.ts` (channelOutboundEnvelopeSchema, intakeChannelSchema genişletme)
- `src/whatsapp.ts` (ChannelProvider interface, GenericInboundMessage, SendMessageResult.provider widening)
- `src/pii-masking.ts` (mask helper'ları)
- `src/index.ts` (export listesi)

Database (`packages/database`):
- `src/index.ts` (`OutboundDeliveryState` + diğer enum export'ları)
- `prisma/schema.prisma` (ChannelType + CitizenIdentifierSource genişletme, OutboundDelivery model, OutboundDeliveryState enum)
- `prisma/migrations/20260507120000_multi_channel_outbound/migration.sql`
- `prisma/seed.ts` (kanal demo verisi)

Docs:
- `docs/checklists/release-checklist.md`
- `docs/checklists/security-kvkk.md`
- `docs/workflows/verify-from-cowork.md`
- `plan-uyum-raporu.md`
- `plan-uygulama-raporu.md`
- `plan-uretim-hazirlik-raporu.md`

## Kalan riskler (kod-bazlı yakalanamaz, runtime gerekir)

Aşağıdakileri ben statik incelemeyle göremem; `pnpm verify` çalıştığında ortaya çıkarsa yakalanır:

- Prisma client'ın `pnpm db:generate` sonrası gerçekten `outboundDelivery` ve `OutboundDeliveryState` üretmesi (şema doğru ama generation hatası olabilir).
- Postgres versiyonunun `ALTER TYPE ... ADD VALUE IF NOT EXISTS` desteklemesi (12+ gerekli; üretim DB'leri 14+ olduğunda sorunsuz).
- BullMQ Queue'nun ilk açılışta Redis erişimi olmaksızın throw atıp atmaması (lazy init + try/catch koruyor ama platform-spesifik durumlar olabilir).
- `tsx --test` çağrısının kullanıcının makinesindeki tsx 4.21 ile uyumlu olması (4.7+ gerekli; kullanılan 4.21).
- Next.js client component bundle'ında `useTransition` ESM tipinin uyuşması (Next 15.5 + React 19.2 — uyumlu kombinasyon).

## Sonraki adım

Senin tarafında tek komut yeterli:

```powershell
pnpm verify
```

Çıktıyı yapıştır, fail eden adım varsa hızlıca kapatırım.
