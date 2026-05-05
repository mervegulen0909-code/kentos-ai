## Summary
- 
- 

## Risk and rollback
- **Risk level:** low / medium / high
- **Rollback plan:** 

## Verification evidence
- [ ] `pnpm db:generate`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] `pnpm smoke:api`
- [ ] `pnpm e2e`

### UI E2E status (required when UI scope changed)
- Status: `passed` / `partial` / `blocked` / `not_run`
- Evidence date:
- Evidence owner:
- Required CI job/result: `ui-e2e` =
- If `partial` or `blocked`, list exact gaps/blockers:
- SLA/owner for unresolved UI E2E gap:

### Browser smoke status (required)
- Status: `passed` / `partial` / `blocked` / `not_run`
- Evidence date:
- Evidence owner:
- If `partial` or `blocked`, list exact gaps/blockers:
- SLA/owner for unresolved browser gap:

## Scope guard
- [ ] No secrets/production env/credentials are staged
- [ ] Local-only files (e.g. `.claude/settings.json`) are excluded from commit scope

## Release note impact
- [ ] `docs/checklists/release-checklist.md` updated (when release-impacting)
- [ ] `docs/workflows/autonomous-run-log.md` updated (when release-impacting)
