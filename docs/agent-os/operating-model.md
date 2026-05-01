# Operating Model

## 1. Planla

Büyük işlerde önce faz planı:

- hedef,
- dosyalar,
- riskler,
- doğrulama komutları,
- stop conditions.

## 2. Uygula

Her faz küçük ve doğrulanabilir olmalı. Aynı anda API ve UI gibi geniş alanları değiştiriyorsan her biri ayrı checkpoint ister.

## 3. Doğrula

Önce scoped check:

```bash
pnpm --filter @kentos/api typecheck
pnpm --filter @kentos/admin-web build
```

Sonra full check:

```bash
pnpm db:generate
pnpm typecheck
pnpm build
```

## 4. Smoke

Runtime davranışı için:

```bash
KENTOS_API_BASE_URL='http://127.0.0.1:3110/api/v1' pnpm smoke:api
```

Browser flow için `docs/workflows/browser-smoke.md`.

## 5. Kaydet

Her başarılı slice `docs/workflows/autonomous-run-log.md` içine yazılır.

## 6. Devret

Başka pencere/session/ajan devralacaksa `.claude/templates/handoff.md` formatı kullanılır.
