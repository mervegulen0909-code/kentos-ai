# Install KentOS Agent OS in Another Project

## 1. Copy files

Copy these into the target project:

```text
CLAUDE.md
.claude/agents/
.claude/commands/
.claude/hooks/
.claude/mcp/README.md
.claude/templates/
docs/agent-os/
```

## 2. Rewrite project specifics

Update:

- project name,
- stack,
- package manager,
- verification commands,
- safe local ports,
- forbidden production actions,
- smoke scripts.

## 3. Add run log

Create:

```text
docs/workflows/autonomous-run-log.md
```

## 4. Add smoke docs

Create project-specific:

```text
docs/workflows/local-smoke.md
docs/workflows/browser-smoke.md
```

## 5. Configure agents

Keep roles but change scope paths. Example:

- API agent owns `server/**` instead of `apps/api/**`.
- Frontend agent owns `web/**` instead of `apps/admin-web/**`.

## 6. Hooks

Do not enable hooks blindly. First inspect Claude Code settings schema for the installed version. Keep destructive command blocking conservative.

## 7. Worktree upgrade

If the target is a git repo, create worktrees for parallel sessions. If not, use non-overlapping file ownership and handoff docs.

## 8. First command to Claude

> Bu projede Agent OS dosyalarını oku, CLAUDE.md'yi güncelle, doğrulama komutlarını tespit et ve ilk güvenli otonom çalışma planını çıkar.
