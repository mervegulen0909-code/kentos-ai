import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outputPath = join(root, 'HANDOFF_PROMPT.md');

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    }).trim();
  } catch (error) {
    const stderr = error.stderr?.toString().trim();
    const stdout = error.stdout?.toString().trim();
    return [`COMMAND_FAILED: ${command} ${args.join(' ')}`, stderr, stdout].filter(Boolean).join('\n');
  }
}

function readIfExists(relativePath, maxLines = 80) {
  if (!existsSync(join(root, relativePath))) return `${relativePath} not found`;
  const content = run('git', ['show', `HEAD:${relativePath}`]);
  if (content.startsWith('COMMAND_FAILED')) return `${relativePath} exists but could not be read from HEAD`;
  return content.split('\n').slice(0, maxLines).join('\n');
}

function statusFor(path) {
  if (!existsSync(join(root, path))) return `${path}: not found`;
  const status = run('git', ['-C', path, 'status', '--short', '--branch']);
  const ahead = run('git', ['-C', path, 'rev-list', '--left-right', '--count', 'master...HEAD']);
  return `${path}\n${status}\nmaster...HEAD: ${ahead}`;
}

const branch = run('git', ['branch', '--show-current']);
const status = run('git', ['status', '--short', '--branch']);
const ahead = run('git', ['rev-list', '--left-right', '--count', 'origin/master...master']);
const log = run('git', ['log', '--oneline', '--decorate', '-12']);
const recentFiles = run('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']);
const remote = run('git', ['remote', '-v']);
const now = new Date().toISOString();

const prompt = `# KentOS AI Handoff Prompt

Generated: ${now}
Workspace: ${root}
Branch: ${branch}

Paste this into Claude/Codex/new chat when you say: "kaldığımız yerden devam et".

\`\`\`text
C:\\Users\\arfgl\\OneDrive\\Desktop\\chatbot projesinde KentOS AI üzerinde kaldığımız yerden devam ediyoruz.

Rolün: 1 — Ana Kontrol / orchestrator. Türkçe çalış. Otonom devam et; destructive, production, secrets, deploy ve external send dışında rutin local işleri sormadan yapabilirsin. Push izni daha önce milestone akışında verilmişti; yine de push öncesi git status, doğrulama ve no-secrets durumunu kontrol et.

Proje özeti:
KentOS AI belediye operasyon platformudur: citizen request/complaint intake, admin panel, SLA, RBAC, public TK tracking token, WhatsApp notification queue, worker idempotency ve smoke/readiness akışları.

Önce oku:
- AGENTS.md
- CLAUDE.md
- README.md
- docs/workflows/parallel-agent-mode.md
- docs/workflows/local-smoke.md
- docs/workflows/browser-smoke.md
- docs/checklists/release-checklist.md
- docs/workflows/autonomous-run-log.md

Son bilinen git durumu:
${status}

origin/master...master ahead count:
${ahead}

Remote:
${remote}

Son commitler:
${log}

Son HEAD dosyaları:
${recentFiles || '(HEAD commit file list empty)'}

Worktree durumları:
${statusFor('../chatbot-api-wave')}

${statusFor('../chatbot-ui-wave')}

${statusFor('../chatbot-qa-wave')}

Son önemli bağlam:
- Public tracking TK-only. Public lookup sadece TK-[A-F0-9]{16} tracking token ile çalışmalı.
- Legacy/internal KNT-* ticketNo public endpointlerde çalışmamalı; güvenli invalid/not-found dönmeli.
- Public response ticketNo/id/tenantId/internal/audit/AI/staff-only alan sızdırmamalı.
- Public messages raw senderType yerine author: municipality | citizen döndürmeli.
- Auth JWT hardening var: access typ=access, refresh typ=refresh; refresh DB’den güncel user/role/isActive/tenant active doğruluyor; JwtStrategy sadece typ=access kabul ediyor.
- Notification templates channel-specific override + generic fallback destekliyor.
- Notification worker idempotent ChannelEvent delivery event kontrolü yapıyor; partial unique index migration var.
- Notification queue lazy init/graceful degrade mantığı var; enqueue failure ticket workflow’u kırmamalı.
- Smoke script @prisma/client’i database package context’inden yüklüyor ve safe JSON parse kullanıyor.
- Admin/citizen UI Türkçe-first, citizen-safe copy ile TK takip kodu mantığına hizalı.
- Tool cache klasörleri .gitignore’da: .codex/ ve .playwright-mcp/.

Son wave’ler:
- Wave 12: TK-only release smoke evidence docs netleştirildi.
- Wave 13: public route paramları :trackingToken olarak hizalandı.
- Wave 14: citizen public ticket page içinde route param değişkenleri trackingToken olarak netleştirildi.

Devam kuralları:
1. Önce git status --short --branch ve git rev-list --left-right --count origin/master...master çalıştır.
2. Worktree kullanacaksan önce ilgili worktree için status ve master...HEAD 0 0 kontrol et; gerideyse local master ile fast-forward hizala.
3. Revert yapma; user/Codex değişikliklerini koru.
4. Küçük, doğrulanabilir slice seç.
5. API değişirse pnpm db:generate, ilgili typecheck, mümkünse pnpm smoke:api.
6. UI değişirse ilgili app typecheck/build; mümkünse browser smoke notu.
7. Finalde pnpm typecheck, pnpm build, git diff --check çalıştır.
8. Commitleri anlamlı parçalara böl; Co-Authored-By satırını koru.
9. Push öncesi git status clean/intended, no secrets staged, ahead count kontrol et.

Öncelikli bir sonraki işler:
- TK-only policy için kalan isimlendirme/docs tutarlılığı varsa küçük düzelt.
- Release checklist ve smoke evidence kayıtlarını güncel tut.
- Admin/citizen browser smoke tekrar koşulabiliyorsa kısa smoke yap.
- Daha büyük feature başlatmadan önce yeni wave planını çıkar.
\`\`\`

## Current quick context files

### AGENTS.md excerpt
\`\`\`md
${readIfExists('AGENTS.md', 120)}
\`\`\`

### Latest autonomous log tail from HEAD
\`\`\`md
${readIfExists('docs/workflows/autonomous-run-log.md', 80).split('\n').slice(-60).join('\n')}
\`\`\`
`;

writeFileSync(outputPath, prompt, 'utf8');
console.log(`Wrote ${outputPath}`);
console.log(prompt);
