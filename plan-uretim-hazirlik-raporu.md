# KentOS AI — Üretim Hazırlık Turu Raporu (Principal Engineer)

Tarih: 2026-05-07
Önceki rapor: `plan-uygulama-raporu.md`

Bu rapor, plan'da tanımlanan tüm fazların kod tarafında bitirilmesinden sonra üretim önündeki gerçek mühendislik açıklarının kapatılmasını özetler. Yedi alt slice halinde uygulandı.

## Özet tablo

| Slice | Konu | Durum |
| --- | --- | --- |
| 1 | Self-audit ve quick-fix | ✅ |
| 2 | Webhook imza doğrulama (Meta + Twilio) | ✅ |
| 3 | Gateway HTTP server wrapper (vanilla node:http) | ✅ |
| 4 | Retention processor → Prisma | ✅ |
| 5 | Outbound BullMQ retry queue | ✅ |
| 6 | Audit log kapsam genişletme | ✅ |
| 7 | Release checklist + KVKK güncellemesi | ✅ |

## Slice 1 — Self-audit ve quick-fix

Önceki turda gözden kaçan tip/runtime tutarsızlıkları:

- `apps/api/src/modules/public/public-widget.controller.ts` — `widget-status` endpoint'i artık `x-probe-origin` header'ını da okuyor. Browser, JavaScript'ten `Origin` header'ını set edemediği için settings panelindeki "Bağlantıyı test et" alanı bu yardımcı header üzerinden allowlist diagnostiğini sürer.
- `apps/api/src/modules/tenants/tenants.service.ts` — `MessageTemplate.channel` güncellemesindeki `as never` cast'i kaldırıldı; DTO'daki tip artık doğrudan Prisma alanına oturuyor.
- `apps/api/src/modules/public/dto/create-public-ticket.dto.ts` — `channel` alanı `IntakeChannel` (WhatsApp, Instagram, Facebook, SMS dahil) kabul edecek şekilde genişletildi. Service-internal `tickets.create(...)` çağrılarındaki sahte cast kaldırıldı.
- `apps/api/src/modules/public/public-ticket.service.ts` ve `public-conversation.service.ts` — `identitySourceForChannel(...)` fonksiyonları INSTAGRAM/FACEBOOK/SMS kanallarını da `CitizenIdentifierSource` enum'una eşliyor.

## Slice 2 — Webhook imza doğrulama

`apps/whatsapp-gateway/src/webhook-signatures.ts` (yeni):

- `verifyMetaWebhookSignature(rawBody, header, appSecret)` — `X-Hub-Signature-256: sha256=<hex>` HMAC doğrulaması. `crypto.timingSafeEqual` ile sabit-zaman karşılaştırması.
- `verifyTwilioWebhookSignature({ fullUrl, formParams, signatureHeader, authToken })` — Twilio'nun standart imza algoritması: HMAC-SHA1(`fullUrl + sortedFormPairs`, authToken) ve base64.

Bu helper'lar, WhatsApp Cloud API + Instagram + Facebook DM ve Twilio SMS için kullanılabilir. Gateway HTTP server'ı bunları otomatik olarak çağırıyor (Slice 3).

## Slice 3 — Gateway HTTP server wrapper

`apps/whatsapp-gateway/src/server.ts` (yeni) — vanilla `node:http` üzerine kurulmuş bir minimal router. Yeni dependency yok; üretimde Cloud Run / Fly / EC2 / Docker üzerinde çalıştırılabilir.

Endpoint'ler:

- `POST /webhooks/whatsapp` — `META_APP_SECRET` yapılandırıldığında imza zorunlu.
- `POST /webhooks/instagram` — aynı imza akışı.
- `POST /webhooks/facebook` — aynı imza akışı.
- `POST /webhooks/sms` — Twilio imzalı POST formu.
- `POST /internal/whatsapp/outbound` — `x-kentos-internal-key` doğrulamalı.
- `POST /internal/instagram/outbound`
- `POST /internal/facebook/outbound`
- `POST /internal/sms/outbound`
- `GET /health` — basit liveness.

`apps/whatsapp-gateway/package.json` script'leri:

- `dev` artık `tsx src/server.ts` ile sunucuyu başlatıyor.
- Yeni `start` script'i: `node dist/.../server.js`.
- `GATEWAY_HTTP_AUTOSTART=false` ile import edildiğinde sunucu otomatik açılmaz (test için).

## Slice 4 — Retention processor → Prisma

`apps/worker/src/prisma-client.ts` (yeni) — `PrismaClient` singleton helper'ı.

`apps/worker/src/processors/retention.processor.ts` artık gerçek silme yapıyor:

- `scope = 'channel-events' | 'outbound-deliveries' | 'audit-logs' | 'conversations' | 'all'` parametrelerini kabul ediyor.
- Her scope için `DEFAULT_RETENTION_DAYS` (60 / 90 / 365 / 180) varsayılan değeri var; job tarafından override edilebilir.
- `prisma.deleteMany(...)` ile cutoff tarihinden eski satırları siler.
- Outbound delivery silme: yalnızca terminal durumlardakileri (DELIVERED/FAILED/SKIPPED) temizler.
- Conversation silme: yalnızca `TICKET_CREATED` veya `CLOSED` durumda olanları temizler — açık konuşmalar dokunulmaz.
- Sonuç olarak `totals: { channelEvents, outboundDeliveries, auditLogs, conversations }` döner; release evidence için ölçülebilir.

## Slice 5 — Outbound BullMQ retry queue

`apps/worker/src/queues/queue-names.ts` — yeni `outbound: 'kentos.outbound'`.

`apps/worker/src/processors/outbound.processor.ts` (yeni):

- `processOutboundJob({ data: { deliveryId } })` Prisma'dan delivery satırını çeker, gateway URL'sini env'den çözer, internal key ile POST atar.
- 5xx/network hatasında throw → BullMQ retry/backoff devreye girer.
- Başarıda `state = DISPATCHED`, `attempts++`, `dispatchedAt`, `externalMessageId` set edilir.
- Başarısızlıkta `state = FAILED`, `lastError` (200 char limitli).

`apps/api/src/modules/public/outbound-dispatch.service.ts` — artık doğrudan fetch yerine BullMQ queue'ya iş atıyor:

- `attempts: 5`, `backoff: exponential 5s`, `removeOnComplete: 200`, `removeOnFail: 1_000`.
- Queue'ya iş atılamazsa delivery PENDING bırakılıyor ve audit log yazılıyor.
- API process'i ayağa kalkarken Redis erişimi yoksa onModuleDestroy'da düzgün kapanış.

## Slice 6 — Audit log kapsam genişletme

`OutboundDispatchService.recordAudit(...)` her dispatch denemesinde `AuditLog` yazıyor:

- `channel.outbound_enqueued` — başarılı queue'ya alma.
- `channel.outbound_enqueue_failed` — Redis/queue erişim sorunu.
- `actorType: SYSTEM` ile.
- Audit log `after` payload'ı: `deliveryId, channel, conversationId, templateKey, error`.

Mevcut `tenant.widget_settings_updated` audit zaten vardı; bu turda yeniden doğrulandı.

## Slice 7 — Release checklist + KVKK

`docs/checklists/release-checklist.md`:

- API smoke listesine `widget-status`, `conversation-segments`, `analytics/channels` ve outbound endpoint kontrolleri eklendi.
- Yeni "Channel gateway HTTP regression" bölümü eklendi (madde 7.5).
- Worker evidence regression bölümüne outbound + retention processor satırları eklendi.

`docs/checklists/security-kvkk.md`:

- Channel security bölümüne Meta + Twilio imza doğrulaması ve `*_OUTBOUND_LIVE` toggle review zorunluluğu.
- Yeni "Multi-channel outbound" bölümü: PII helper kullanımı, audit log, retry/backoff politikası.
- Yeni "Rate limit and abuse" bölümü: Redis bucket, tenant allowlist, widget-status safety.
- Yeni "Retention and KVKK lifecycle" bölümü: scope listesi, per-tenant override, identity merges.

## Üretim önünde kalan adımlar

Kod hazır. Sıradaki sorumluluklar:

1. **Yerel doğrulama dizisi (kullanıcı tarafında)**:
   ```bash
   pnpm install
   pnpm db:generate
   pnpm db:migrate
   pnpm db:seed
   pnpm typecheck
   pnpm build
   pnpm smoke:api
   pnpm --filter @kentos/whatsapp-gateway test
   pnpm --filter @kentos/worker typecheck
   ```
   Workspace bash bu oturumda açılmadığı için yukarıdaki komutlar manuel çalıştırılmalı; çıkan herhangi bir hata fix-up turu için iletilir.

2. **Browser smoke**:
   - `/reports` sayfası kanal kartları ve segment kartları (seed sonrası dolu görünür).
   - `/settings` sayfası "Bağlantıyı test et" butonu canlı endpoint'i çağırır.
   - `/handoffs` sayfası INSTAGRAM/FACEBOOK/SMS etiketlerini doğru gösterir.

3. **Env yapılandırması (staging/prod)**:
   - `INTERNAL_API_KEY` — production değeri, `change-me-internal` reddediliyor.
   - `REDIS_URL` — multi-instance rate limit + queue.
   - `META_APP_SECRET` — Instagram + Facebook + WhatsApp Cloud webhook imzası.
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
   - `INSTAGRAM_GRAPH_TOKEN`, `FACEBOOK_PAGE_TOKEN`.
   - Tenant fallback'leri: `INSTAGRAM_DEFAULT_TENANT_ID`, `FACEBOOK_DEFAULT_TENANT_ID`, `SMS_DEFAULT_TENANT_ID`.
   - Outbound base URL'leri: `CHANNEL_GATEWAY_BASE_URL` (ortak) veya `WHATSAPP_GATEWAY_BASE_URL`, `INSTAGRAM_GATEWAY_BASE_URL`, vb.
   - LIVE toggles: `WHATSAPP_OUTBOUND_LIVE`, `INSTAGRAM_OUTBOUND_LIVE`, `FACEBOOK_OUTBOUND_LIVE`, `SMS_OUTBOUND_LIVE` (default kapalı, dry-run + log).
   - Public gateway URL: `PUBLIC_GATEWAY_BASE_URL` (Twilio imzasının doğrulayacağı tam URL bunu kullanır).

4. **Deploy topolojisi**:
   - `apps/api` — NestJS HTTP servisi (Cloud Run / EKS / VM).
   - `apps/admin-web` ve `apps/citizen-web` — Next.js (Vercel veya kendi node).
   - `apps/whatsapp-gateway` — yeni HTTP server, kendi container'ı, public webhook'lar buraya yönlenir.
   - `apps/worker` — BullMQ worker, internal worker servisi.
   - Gerekli network kuralları: API → Redis, API → Postgres, Worker → Redis + Postgres, Gateway → API (`/internal/channel-ingest`), API → Gateway (`/internal/<channel>/outbound`).

5. **İlk LIVE açılış sırası (önerim)**:
   - Önce dry-run (default) ile staging'de uçtan uca trafik sürmek.
   - WhatsApp imza ve gateway sertifikası doğrulandıktan sonra `WHATSAPP_OUTBOUND_LIVE=true`.
   - 24 saat error budget izlendikten sonra Instagram/Facebook/SMS LIVE flag'lerini kademeli aç.
   - Her LIVE toggle için audit log + run-log entry zorunlu (KVKK checklist'inde madde olarak duruyor).

## Bu turda dokunulan dosyalar

API (`apps/api`):
- `src/common/services/rate-limit.service.ts` (önceki turda)
- `src/common/guards/public-channel.guard.ts` (önceki turda)
- `src/modules/public/outbound-dispatch.service.ts` (queue-tabanlı + audit yazımı)
- `src/modules/public/public-widget.controller.ts` (probe header)
- `src/modules/public/public-conversation.service.ts` (identity source çoklu kanal)
- `src/modules/public/public-ticket.service.ts` (identity source çoklu kanal)
- `src/modules/public/dto/create-public-ticket.dto.ts` (kanal listesi)
- `src/modules/tenants/tenants.service.ts` (cast kaldırma)

Gateway (`apps/whatsapp-gateway`):
- `src/server.ts` (yeni HTTP server)
- `src/webhook-signatures.ts` (yeni)
- `package.json` (dev/start script'leri)

Worker (`apps/worker`):
- `src/prisma-client.ts` (yeni)
- `src/processors/retention.processor.ts` (gerçek deleteMany)
- `src/processors/outbound.processor.ts` (yeni)
- `src/queues/queue-names.ts` (outbound queue eklendi)
- `src/main.ts` (yeni worker kayıtları)

Docs:
- `docs/checklists/release-checklist.md` (smoke + worker + gateway maddeleri)
- `docs/checklists/security-kvkk.md` (channel security + multi-channel outbound + rate limit + retention bölümleri)

## Risk değerlendirmesi

| Risk | Şiddet | Azaltım |
| --- | --- | --- |
| Multi-channel enum migration prod'da bekleyen veriyle çatışırsa | Yüksek | Migration `ADD VALUE IF NOT EXISTS` kullanır; idempotent. Yine de prod öncesi blue-green replica üzerinde dry-run önerilir. |
| Outbound queue Redis erişimi düşerse delivery PENDING'de kalır | Orta | OnModuleDestroy + lazy `getQueue()` koruyor; Redis düştüğünde API çalışmaya devam eder, conversation cevabı UI'da gösterilir, sadece dış kanal cevabı geri kalır. Health probe + Redis alarm ile izlenmeli. |
| Twilio imza doğrulamasının `fullUrl` parçası proxy arkasında yanlış üretilirse | Orta | `PUBLIC_GATEWAY_BASE_URL` env'i tam URL üretmek için kullanılıyor. Reverse-proxy konfigürasyonu staging'de doğrulanmalı. |
| WhatsApp + Instagram + Facebook hepsi `META_APP_SECRET`'ı paylaşıyor | Orta | Üç farklı Meta app kullanılıyorsa per-channel ayrı env eklenmeli; kod genişletilebilir, şu an tek secret tüm Meta kanallarını kapsar. |
| `tickets.create(...)` artık herhangi bir kanalı kabul ediyor | Düşük | Public POST endpoint'i RBAC + DTO IsIn ile gated; cross-channel saldırı yüzeyi `WHATSAPP/INSTAGRAM/FACEBOOK/SMS`'i bilinçli olarak kabul ediyor çünkü conversation-driven path'i kapatmamak gerekiyor. Audit log ile takip edilebilir. |

## Bilgi notu

Workspace bash bu oturumda erişilemediği için `pnpm typecheck / build / db:generate` çalıştırılamadı. Tüm değişiklikler statik incelemeye dayanıyor. Yerel doğrulamada hata çıkarsa hızlı bir fix-up turuyla kapatılır; raporun "Üretim önünde kalan adımlar" başlığı bunu liste başı olarak işaretliyor.
