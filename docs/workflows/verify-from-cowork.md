# Cowork ↔ Local Doğrulama Kanalı

Cowork oturumunda workspace bash kapalı olduğunda, yerel doğrulamayı tek komut ile çalıştırıp sonucu Claude'a raporlayan akış.

## Tek komut

```powershell
pnpm verify
```

veya doğrudan:

```powershell
node scripts/verify-env.mjs
```

Script `verification-report.txt` dosyasını üretir; içeriği bana `cat verification-report.txt` çıktısı olarak yapıştırman yeterli (Windows'ta PowerShell'de `Get-Content verification-report.txt`).

## Ne yapar

`scripts/verify-env.mjs` aşağıdaki adımları sırayla, **hata çıksa bile devam ederek** çalıştırır ve her birinin pass/fail durumunu yakalar:

| id | komut | açıklama |
| --- | --- | --- |
| `pnpm-version` | `pnpm --version` | toolchain hazır mı |
| `node-version` | `node --version` | toolchain hazır mı |
| `install` | `pnpm install` | yeni gateway/worker devDeps'lerini çek |
| `db-generate` | `pnpm db:generate` | Prisma client'ı yenile (yeni `OutboundDelivery` modeli + enum değerleri için) |
| `typecheck` | `pnpm typecheck` | tüm workspace boyunca TS check |
| `build` | `pnpm build` | tüm app build'i |
| `whatsapp-test` | `pnpm --filter @kentos/whatsapp-gateway test` | gateway unit testleri (intake-forwarder, outbound-handler) |
| `shared-test` | `pnpm --filter @kentos/shared test` | (varsa) shared paket testleri — opsiyonel |
| `worker-typecheck` | `pnpm --filter @kentos/worker typecheck` | worker app typecheck |

## Hızlı modlar

- Sadece typecheck ve build: `pnpm verify --only static`
- Sadece testleri koş: `pnpm verify --only test`
- DB adımını atla (örn. local Postgres yoksa): `pnpm verify --skip db`
- Tek bir adımı koş: `pnpm verify --only typecheck`

## Hata durumunda

Script bir adım failed ise:

1. `verification-report.txt` dosyasındaki ilgili `### <step>` blokunu bana iletmen yeterli.
2. Detay log son 12.000 karakter ile sınırlandırılmıştır; çoğu TypeScript / Prisma / pnpm hatası buradan rahatça okunur.
3. Ben hatayı görür, fix edip yeni dosyaları üretirim, sen tekrar `pnpm verify --only <step>` çalıştırırsın.

## Smoke ve E2E

Smoke ve Playwright e2e bu script kapsamında değil (Docker/Postgres/Redis ayrıca lazım). Onlar ayrı komutlar:

```powershell
$env:DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public'
$env:KENTOS_API_BASE_URL='http://127.0.0.1:3110/api/v1'
pnpm smoke:api
pnpm e2e
```

`verify` script'i, statik doğrulamayı tek tıkla bitirip "kod hazır" sinyalini Cowork tarafına geri taşımak içindir.
