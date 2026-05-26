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

`pnpm` PATH'te degilse, root Node entrypoint'leri `npm run` ile de baslatabilirsiniz:

```powershell
npm run verify -- --help
npm run ops:preflight -- --help
```

Windows PowerShell execution policy `npm.ps1` calismasini engelliyorsa `npm.cmd run ...` kullanin.

Makinede kalici kurulum gerekiyorsa once `corepack enable` calistirip yeni terminal acin. Workspace icindeki gercek `pnpm` komutlari icin kanonik yol yine `pnpm ...` komutlaridir.

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
| `api-test` | `pnpm --filter @kentos/api test` | API unit testleri |
| `worker-test` | `pnpm --filter @kentos/worker test` | worker unit testleri |
| `gateway-test` | `pnpm --filter @kentos/whatsapp-gateway test` | gateway unit testleri |
| `admin-web-test` | `pnpm --filter @kentos/admin-web test` | admin-web unit testleri |
| `shared-test` | `pnpm --filter @kentos/shared test` | shared paket testleri |
| `citizen-web-test` | `pnpm --filter @kentos/citizen-web test` | citizen-web testleri |
| `diff-check` | `git diff --check` | whitespace / patch hygiene |
| `playwright-list` | `pnpm exec playwright test --config tests/playwright.config.ts --list` | Playwright smoke discovery (opsiyonel) |

## Hızlı modlar

- Sadece typecheck ve build: `pnpm verify --only static`
- Sadece testleri koş: `pnpm verify --only test`
- DB adımını atla (örn. local Postgres yoksa): `pnpm verify --skip db`
- Tek bir adımı koş: `pnpm verify --only typecheck`
- Playwright discovery adımını atla: `pnpm verify --skip ui`

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

`verify` script'i, repo-ici unit/static gate'i tek entrypoint altinda toplar. Final release gate icin bunun ardindan `pnpm ops:preflight -- --with-verification` calistirilir.
