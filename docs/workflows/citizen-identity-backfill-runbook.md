# Citizen Identity Backfill Dry-Run Runbook

Bu runbook, [`apps/api/src/citizen-identity-backfill.ts`](apps/api/src/citizen-identity-backfill.ts:1) üzerinden citizen identity reconciliation Phase 2 dry-run hazırlığını standartlaştırır. Amaç, Phase 3 unique enforcement öncesinde tenant bazlı merge adaylarını, manual review kümelerini ve Phase 3 readiness durumunu ölçülebilir şekilde çıkarmaktır.

## Amaç

[`CitizenIdentityService.backfillTenantCitizens()`](apps/api/src/modules/public/citizen-identity.service.ts:156) çıktısı operasyon ekibi tarafından üç soru için kullanılmalıdır:

İlk soru, hangi tenantlarda merge uygulanabilir adaylar bulunduğudur. İkinci soru, hangi kümelerin `manual_review` gerektirdiğidir. Üçüncü soru ise tenantın `readyForPhase3` durumuna ulaşıp ulaşmadığıdır.

Dry-run aşamasında veri mutasyonu yapılmaz. `apply` modu, ancak dry-run çıktısı gözden geçirilip açık exception kalmadığında kullanılmalıdır.

## Ön koşullar

Dry-run öncesinde aşağıdaki doğrulama sırası tamamlanmış olmalıdır:

- [`pnpm db:generate`](package.json:13)
- [`pnpm --filter @kentos/api typecheck`](apps/api/package.json:11)
- Hedef ortam için geçerli [`DATABASE_URL`](packages/database/prisma/schema.prisma:7)
- Phase 1 identifier-backed write path’in zaten aktif olması

Ek olarak, aynı veri seti üzerinde rapor karşılaştırması yapılacaksa çalıştırmalar sırasında yeni seed/import işi tetiklenmemesi tercih edilir.

## Çalıştırma komutları

Tek tenant dry-run:

```bash
pnpm citizen-identity:backfill --tenant <tenantId> --dry-run
```

Tek tenant dry-run ve dosyaya yazım:

```bash
pnpm citizen-identity:backfill --tenant <tenantId> --dry-run --output output/citizen-identity/<tenantId>-dry-run.json
```

Tüm tenantlar için dry-run:

```bash
pnpm citizen-identity:backfill --all-tenants --dry-run --output output/citizen-identity/all-tenants-dry-run.json
```

Mutasyonlu uygulama yalnızca onay sonrası kullanılmalıdır:

```bash
pnpm citizen-identity:backfill --tenant <tenantId> --apply --output output/citizen-identity/<tenantId>-apply.json
```

## Çıktı sözleşmesi

CLI root çıktısı [`main()`](apps/api/src/citizen-identity-backfill.ts:69) içinde şu alanları üretir:

- `generatedAt`
- `mode`
- `tenantCount`
- `readyForPhase3`
- `unresolvedExceptionCount`
- `mergeCandidateCount`
- `reports`

Her tenant raporu [`TenantCitizenBackfillReport`](apps/api/src/modules/public/citizen-identity.service.ts:76) formatındadır. İncelenmesi gereken ana alanlar:

- `totals.scannedCitizenCount`
- `totals.processedClusterCount`
- `totals.mergeCount`
- `totals.manualReviewCount`
- `totals.ticketRepointCount`
- `totals.conversationRepointCount`
- `exceptions`
- `readiness.readyForPhase3`
- `readiness.note`

Her küme raporu [`TenantCitizenBackfillClusterReport`](apps/api/src/modules/public/citizen-identity.service.ts:60) formatındadır. Özellikle şu alanlar karar için kritiktir:

- `action`
- `survivorCitizenId`
- `duplicateCitizenIds`
- `matchedIdentifierValues`
- `scorecard`
- `reviewReason`
- `identifierSyncPlan`

## Operasyonel yorumlama kuralları

`action = manual_review` olan her küme Phase 3 için blokerdir. Bu kümeler kapatılmadan `readyForPhase3 = true` kabul edilmemelidir.

`action = merge` kümeleri, dry-run modunda gerçek merge yapmaz; bunlar yalnızca uygulanabilir adaylardır. Bu nedenle `mergeCount > 0` tek başına risk değildir. Risk, `manualReviewCount > 0` olmasıdır.

`reviewReason` şu anda iki sınıfa ayrılır:

- `CONFLICTING_IDENTIFIER_OWNERS`: aynı cluster içinde identifier sahipliği çakışıyor
- `TIED_CANONICAL_SCORE`: deterministic survivor seçimi tam eşitliğe düşüyor

Bu iki durumda da kayıt düzeyinde insan kararı gerekir. Gerekirse ilgili citizen kayıtları, ticket bağlantıları ve conversation geçmişi ayrı sorgularla incelenmelidir.

## Release evidence için minimum kayıt

Her dry-run turunda aşağıdaki bilgi saklanmalıdır:

- çalıştırma zamanı
- komut tam hali
- hedef tenant veya `all-tenants`
- çıktı dosyası yolu
- `unresolvedExceptionCount`
- `mergeCandidateCount`
- `readyForPhase3`
- açık manual review cluster listesi

Bu kayıt, release evidence snapshot ve reconciliation kapanış notuna bağlanmalıdır.

## Stop koşulları

Aşağıdaki durumlardan biri görülürse dry-run turu başarılı sayılmaz:

- CLI hata ile çıkarsa
- çıktı JSON parse edilemiyorsa
- herhangi bir tenant için `readiness.readyForPhase3 = false` ve exception owner atanmamışsa
- beklenmeyen biçimde `processedClusterCount = 0` fakat tenantta citizen verisi bulunduğu biliniyorsa

## Apply öncesi zorunlu kapı

`apply` moduna geçmeden önce şu kapıların kapalı olması gerekir:

- dry-run JSON çıktısı arşivlenmiş olmalı
- manual review kümeleri kararlandırılmış olmalı
- ilgili tenant için rollback notu hazırlanmış olmalı
- son statik doğrulama olarak [`pnpm db:generate`](package.json:13), [`pnpm --filter @kentos/api typecheck`](apps/api/package.json:11) ve tercihen [`pnpm build`](package.json:8) geçmiş olmalı

## Önerilen takip adımı

Faz 1 kapsamında bir sonraki adım, seeded veya hedef test tenantı üzerinde [`pnpm citizen-identity:backfill`](package.json:22) ile gerçek bir `--dry-run --output ...` raporu üretmek ve çıkan `exceptions` listesini operasyonel review formatına dökmektir.
