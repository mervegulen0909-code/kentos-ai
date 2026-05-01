# Skills and Commands

Bu repo, Claude Code slash-command benzeri workflow dosyalarını `.claude/commands/` altında tutar.

## Komutlar

- `kentos-plan.md`: büyük iş planı çıkarma.
- `kentos-wave.md`: onaylı fazı uygulama.
- `kentos-smoke.md`: local API/browser smoke doğrulama.
- `kentos-review.md`: pre-ship review.
- `kentos-handoff.md`: session/ajan devri.

## Nasıl kullanılır

Claude'a şunu söyle:

> `.claude/commands/kentos-wave.md` workflow'unu uygula; hedef: admin settings validation UX.`

Eğer ortam doğrudan slash command destekliyorsa aynı mantık `/kentos-wave` olarak paketlenebilir.

## Neden dosya olarak tutuluyor?

- Projeye özel.
- Versiyonlanabilir.
- Başka projelere kopyalanabilir.
- Claude oturumu değişse bile workflow aynı kalır.
