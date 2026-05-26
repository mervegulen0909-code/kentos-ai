# Remaining Launch Plan

Last updated: 2026-05-22

## Current State

- Production SSH/root access has been recovered on Hetzner.
- Production stack health is green (`api`, `gateway`, `worker`, `web`, `db`, `redis`, `minio`, `clamav`, `caddy` healthy).
- `npm run verify` passes on Windows.
- `npm run ops:preflight -- --with-verification --json` is green on technical checks and blocked only by git hygiene state.

## Phase 1: Repo Closure

Status: In progress

Goal: separate today's safe delivery set from unrelated local work and close the repo state without losing existing local history.

### Safe delivery set from this session

- `apps/admin-web/package.json`
- `apps/api/package.json`
- `apps/api/src/modules/tickets/tickets.service.ts`
- `apps/api/src/modules/users/users.service.ts`
- `apps/worker/package.json`
- `apps/worker/src/processors/reports.processor.ts`
- `docs/releases/RELEASE_NOTES.md`
- `docs/workflows/autonomous-run-log.md`
- `docs/workflows/production-infra-runbook.md`
- `package.json`
- `scripts/ops-preflight.mjs`
- `scripts/verify-env.mjs`

### Repo blockers

- Working tree is dirty.
- `master` is ahead of `origin/master` by 7 commits.

### Required actions

1. Keep today's delivery set isolated from unrelated local modifications.
2. Audit the 7 local commits before any push or release action.
3. Decide whether to:
   - stage only the safe delivery set into a fresh commit, or
   - first reconcile the existing local commit queue.
4. Do not treat `git-clean` as a code failure; treat it as release hygiene debt.

## Phase 2: External Provider Closure

Status: Pending

Goal: clear non-code launch blockers so outbound and production messaging can move from placeholder/trial state to live state safely.

### Meta / WhatsApp

1. Complete Meta business verification.
2. Attach the real production number `+90 535 281 12 35` to the production app.
3. Replace temporary/trial credentials with permanent production credentials.
4. Confirm webhook, app secret, and payment/business prerequisites.

### Twilio

1. Exit trial mode if Twilio remains part of fallback or voice flows.
2. Confirm final sending/verified number strategy.
3. Confirm MFA and operator ownership for the account.

### Postmark / Email

1. Move Postmark out of `Test mode`.
2. Confirm production sender identity.
3. Validate inbound/outbound production routing after DNS is complete.

### DNS

1. Recover access to the `cebtecep.com` DNS control panel.
2. Add DKIM records.
3. Add Return-Path / bounce domain records if required by the email provider.
4. Re-verify DNS-dependent provider checks after propagation.

## Phase 3: Approval Gates

Status: Pending

Goal: explicitly decide which high-risk switches are allowed in production.

1. Live outbound approval (`WHATSAPP_OUTBOUND_LIVE`, `EMAIL_OUTBOUND_LIVE`).
2. Retention live delete approval.
3. Paid AI features enablement approval.
4. Any production deploy approval that changes runtime state.

## Phase 4: Final Release Readiness Sweep

Status: Pending

Goal: run a final operator sweep after repo hygiene and provider setup are complete.

1. Re-run `npm run verify`.
2. Re-run `npm run ops:preflight -- --with-verification --json`.
3. Re-run external system evidence capture if provider state changed.
4. Confirm git state is intentional and release-safe.
5. Update release notes and run log with the final launch checkpoint.

## Recommended Immediate Order

1. Finish repo closure strategy for the safe delivery set.
2. Audit the 7 local commits on `master`.
3. Resolve Meta / Postmark / DNS blockers.
4. Re-run preflight after external changes.
5. Perform the final release readiness sweep.
