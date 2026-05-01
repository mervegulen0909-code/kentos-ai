# KentOS Agent OS

Bu klasör, görsellerdeki Claude Code çalışma kavramlarını KentOS projesi için uygulanabilir bir sisteme çevirir.

## Kavram eşleşmesi

- **Hooks:** Komut öncesi/sonrası güvenlik ve doğrulama tetikleri.
- **Sub-agents:** Belirli görev için izole uzman rol dosyaları.
- **Agent teams:** Büyük işi API, frontend, QA, docs, security rolleri arasında bölme.
- **Multiple sessions:** Aynı projede birden fazla Claude penceresiyle non-overlap çalışma.
- **Git worktrees:** Git repo olduğunda çakışmasız paralel branch klasörleri. Detay: [git-worktrees.md](git-worktrees.md).
- **Frameworks:** `CLAUDE.md`, workflow komutları ve dokümante kalite standardı.
- **Triggers/scheduled tasks/loop:** Uzun süren lokal işleri güvenli aralıklarla takip etme.
- **Ultra plan:** Büyük fazları önce planlayıp sonra unattended uygulama.

## Dosyalar

```text
CLAUDE.md                         Proje çalışma framework'ü
.claude/agents/*.md               Uzman ajan rol tanımları
.claude/commands/*.md             Tekrar kullanılabilir workflow komutları
.claude/hooks/*.mjs               Güvenli hook örnekleri
.claude/mcp/README.md             MCP kullanım politikası
.claude/templates/*.md            Handoff ve başka proje kurulum şablonları
docs/agent-os/*.md                Sistemin nasıl kullanılacağı
```

## Günlük kullanım

1. Büyük işe başlamadan `CLAUDE.md` ve son logu oku.
2. İş büyükse `/kentos-plan` mantığıyla faz planı çıkar.
3. Onaydan sonra `/kentos-wave` mantığıyla slice slice ilerle.
4. API değiştiyse `/kentos-smoke` mantığıyla local smoke çalıştır.
5. Başka pencereye geçeceksen `/kentos-handoff` mantığıyla handoff yaz.

## En önemli kural

Rutin local işler otonom yapılabilir; deploy, secrets, dış mesaj, paid API, büyük download ve destructive işlemler her zaman onay ister.
