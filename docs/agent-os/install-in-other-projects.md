# Başka Projelerde Agent OS Kurulumu

Bu sistemi başka bir projeye taşımak için `.claude/templates/other-project-install.md` dosyasını ana rehber olarak kullan.

## Minimum kurulum

```text
CLAUDE.md
.claude/agents/*.md
.claude/commands/*.md
.claude/templates/handoff.md
docs/agent-os/README.md
docs/workflows/autonomous-run-log.md
```

## Projeye göre değiştirilecek alanlar

- Stack: Next/Nest/Prisma yerine proje stack'i.
- Komutlar: `pnpm` yerine `npm`, `yarn`, `bun`, `go test`, `pytest`, vb.
- Smoke: local endpointler ve test kullanıcıları.
- Ajan rolleri: API/frontend/QA yerine projenin gerçek modülleri.
- Güvenlik sınırları: production, secrets, deploy, external sends.

## Kurulum sonrası test

Claude'a şunu yaptır:

1. `CLAUDE.md` oku.
2. Ajan dosyalarını oku.
3. Projede typecheck/test/build komutlarını tespit et.
4. Docs-only bir checkpoint oluştur.
5. Hiçbir production aksiyonuna dokunmadan ilk küçük doğrulamayı çalıştır.

## En iyi pratik

Her projede önce framework + log + smoke standardını kur, sonra kod üretimine geç. Bu, otonom modun kontrolsüz büyümesini engeller.
