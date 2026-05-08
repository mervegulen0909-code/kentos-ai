# Citizen Identity Apply Rollback Note

Tarih: 2026-05-07
Tenant: `cmophayio0000kovgkksj6f25`
Kapsam: [`pnpm citizen-identity:backfill`](package.json:22) ile tenant-scoped [`--apply`](apps/api/src/citizen-identity-backfill.ts:34) çalıştırması
Dry-run kanıtı: [`output/citizen-identity/all-tenants-dry-run.json`](output/citizen-identity/all-tenants-dry-run.json)
Runbook: [`docs/workflows/citizen-identity-backfill-runbook.md`](docs/workflows/citizen-identity-backfill-runbook.md)

## Apply öncesi durum

Dry-run sonucu `readyForPhase3=true`, `unresolvedExceptionCount=0`, `mergeCandidateCount=14` döndü. Tenant özeti olarak `scannedCitizenCount=42`, `processedClusterCount=28`, `mergeCount=14`, `manualReviewCount=0`, `ticketRepointCount=14`, `conversationRepointCount=0` kaydedildi.

Bu nedenle controlled apply yalnızca bu tenant için, mevcut dry-run çıktısı arşivlenmiş halde ilerletilir.

## Beklenen değişiklik tipi

[`CitizenIdentityService.backfillTenantCitizens()`](apps/api/src/modules/public/citizen-identity.service.ts:156) apply modunda şu veri mutasyonlarını yapabilir:

- duplicate citizen kayıtlarını canonical survivor altına merge işaretlemek
- [`Ticket.citizenId`](packages/database/prisma/schema.prisma:301) alanlarını canonical citizen’a repoint etmek
- [`Conversation.citizenId`](packages/database/prisma/schema.prisma:346) alanlarını canonical citizen’a repoint etmek
- identifier setlerini survivor citizen üzerinde senkronize etmek

## Uygulama sonrası doğrulama

Apply sonrası şu artefaktlar alınmalıdır:

- tenant-scoped apply JSON çıktısı
- tekrar dry-run çıktısı
- [`pnpm --filter @kentos/api typecheck`](apps/api/package.json:11) sonucu

Ek olarak aşağıdaki alanlar kontrol edilmelidir:

- apply sonrası `manualReviewCount=0`
- apply sonrası `exceptions=[]`
- apply sonrası `readyForPhase3=true`
- beklenen merge sayısının düşmesi veya `merge` adaylarının `noop` / `sync_identifiers` durumuna evrilmesi

## Rollback yaklaşımı

Bu işlem veri mutasyonu içerdiği için otomatik kod rollback’i yeterli değildir. Sorun çıkarsa aşağıdaki yaklaşım izlenir:

1. Apply çıktısı ve önceki dry-run çıktısı karşılaştırılır.
2. Etkilenen citizen kümeleri apply raporundaki `clusterCitizenIds`, `survivorCitizenId` ve `duplicateCitizenIds` üzerinden izole edilir.
3. Gerekirse veritabanı yedeğinden tenant-scoped geri dönüş veya manuel düzeltme uygulanır.
4. Phase 3 enforcement durdurulur; yeni unique constraint adımına geçilmez.
5. Olay kaydı release evidence ve run-log içine blocker olarak işlenir.

## Stop koşulu

Aşağıdaki durumlardan biri oluşursa apply sonrası ilerleme durdurulmalıdır:

- apply komutu hata ile çıkarsa
- apply sonrası tekrar dry-run `readyForPhase3=false` dönerse
- `manual_review` kümeleri oluşursa
- beklenmeyen ticket veya conversation repoint farkı görülürse
- JSON raporu üretilemezse
