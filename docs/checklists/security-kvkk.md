# Security and KVKK Checklist

## Production env generation

- [x] `scripts/bootstrap-prod-env.mjs` writes only to `.env.production.local`, which `.gitignore` excludes from the repository.
- [x] All production secrets are generated locally with `crypto.randomBytes` (postgres, redis, S3 access/secret, JWT access/refresh, internal API key) — values are not printed to stdout and are not embedded in any committed file.
- [x] `.dockerignore` excludes `.env` and `.env.*` while allowing `.env.example`, so `.env.production.local` cannot leak into the production image build context.
- [ ] Operator rotates production secrets via re-running `pnpm infra:prod:bootstrap -- --force` and stores the prior file securely outside git before overwriting.
- [ ] DNS records for `API_DOMAIN`, `ADMIN_DOMAIN`, `CITIZEN_DOMAIN`, `GATEWAY_DOMAIN`, and `MUNICIPALITY_DOMAIN` are pointed at the production host before Caddy auto-TLS is allowed to issue certificates.

## Data minimization

- [ ] Store only necessary citizen contact data.
- [ ] Keep internal notes separate from public messages.
- [x] AI runs do not expose chain-of-thought to citizens; AiRun.input/output JSON columns intentionally store only tenantSlug, channel, intent, requestType, confidence — no citizen contact, no prompt, no model-internal reasoning.
- [ ] Keep export/delete readiness in model and API design.

## AI provider safety

- [x] `AI_PROVIDER=stub` is the default; live providers (`anthropic`, `netiva`) require an explicit credential to activate.
- [x] Daily token + cost budgets per tenant enforced at runtime via `AiRun` aggregate query before each live call. Budget exceedance silently falls back to the deterministic stub and records `errorReason='budget:token-budget-exceeded'` for audit visibility.
- [x] AiRun telemetry rows (`tokensInput`, `tokensOutput`, `tokensTotal`, `costMicros`, `latencyMs`, `success`, `errorReason`) support per-tenant cost review without exposing prompt content.

## Access control

- [x] Every staff/admin endpoint is tenant scoped; local smoke covers cross-tenant/public lookup rejection and department-scoped staff visibility.
- [x] RBAC guards protect privileged actions through `RolesGuard` plus endpoint role annotations; smoke covers operator/read-only/department-staff denied analytics and mutation paths.
- [x] Department staff cannot access unrelated department queues unless role allows it; smoke verifies out-of-department list/detail/mutation requests are denied safely.

## Auditability

- [x] Ticket create/status/assign/note/public message/resolve/close actions write audit logs and smoke verifies the main mutation actions.
- [x] Audit logs include actor, action, timestamp, and before/after where relevant; settings and ticket mutation smoke validates actor attribution.

## Input and upload safety

- [x] DTOs validate request input for public/admin ticket, tenant settings, channel, and attachment paths.
- [x] File uploads validate MIME, size, and storage key metadata before binding or media processing.
- [x] Presigned upload responses do not expose internal storage keys; API smoke asserts the public response shape.
- [x] Attachment confirm requires a SHA-256 checksum before ticket/message binding.
- [x] Confirmed attachments can be linked only within the same tenant and expected actor scope.
- [x] Closed/rejected tickets reject new attachment upload, confirm, or binding attempts.
- [x] Private object access uses signed download endpoints instead of permanent public object URLs.
- [x] Media processor records object metadata checks plus per-attachment scan status (`PENDING|CLEAN|INFECTED|ERROR|SKIPPED`); ClamAV INSTREAM is wired in and runs when `ATTACHMENT_SCAN_PROVIDER=clamav`. Infected attachments are blocked at the signed-download API for both admin and public paths. Scan results stay independent from retention.

## Channel security

- [x] WhatsApp gateway uses internal auth when calling API; smoke rejects missing `x-kentos-internal-key`.
- [x] Meta Cloud API webhook signatures are verified before production use when `META_APP_SECRET` is configured.
- [x] Instagram + Facebook webhook signatures (`X-Hub-Signature-256` / `META_APP_SECRET`) are verified before LIVE outbound flag is enabled for that channel.
- [x] Twilio SMS webhook signatures (`X-Twilio-Signature` / `TWILIO_AUTH_TOKEN`) are verified before LIVE outbound flag is enabled.
- [x] Each channel `*_OUTBOUND_LIVE=true` toggle is reviewed by tenant operator before enabling and recorded in the run-log. EMAIL channel: `EMAIL_OUTBOUND_LIVE=false` by default; live send requires `EMAIL_FROM_ADDRESS` plus either SMTP host/port credentials or `POSTMARK_SERVER_TOKEN`.
- [x] Baileys remains demo/local only.

## Multi-channel outbound (Faz 4 + Faz 7)

- [x] `OutboundDelivery` retention is bounded by the retention worker (default 90 days, terminal states only).
- [ ] `OutboundDelivery.body` does not include unmasked national IDs; PII helpers in `@kentos/shared` (`maskPii`, `safeLogString`) are used in any structured log emission downstream of the dispatcher.
- [x] Outbound dispatcher writes `channel.outbound_enqueued` / `channel.outbound_enqueue_failed` audit log per queued delivery.
- [x] Outbound retry uses BullMQ exponential backoff with bounded attempts; worker failures increment attempts once and leave `lastError` for admin review.

## Rate limit and abuse

- [x] Public widget channel uses Redis-backed rate limit when `REDIS_URL` is configured; in-memory fallback is used when Redis is unavailable.
- [x] Tenant `widgetAllowedOrigins` is the source of truth; env `WIDGET_ORIGIN_ALLOWLIST` is operational override only.
- [x] `/public/:tenantSlug/widget-status` is safe to expose: it does not reveal allowlist contents, only count and per-origin allowed boolean.

## Retention and KVKK lifecycle

- [x] Retention worker (`kentos.retention`) is scheduled through `RetentionQueueService` (`retention:daily`, 03:00 UTC default) and can be manually invoked for `all`; processor supports each scope: `channel-events`, `outbound-deliveries`, `audit-logs`, `conversations`, `attachments`.
- [x] Attachment retention is included in the retention processor scope with dry-run default; real DB/object deletion requires explicit job/env flags and separate production approval.
- [x] Per-tenant retention overrides are configurable via `PATCH /retention-settings` (SUPER_ADMIN/TENANT_ADMIN) and the admin settings panel; out-of-range values are rejected, every change writes a `tenant.retention_settings_updated` audit log, and live deletion remains gated by worker `RETENTION_DRY_RUN`/`RETENTION_DELETE_ATTACHMENT_OBJECTS` flags. Default retention windows are sourced from `@kentos/shared` `DEFAULT_RETENTION_DAYS`.
- [ ] Citizen identity merges/imports keep the audit trail and do not silently drop prior identifiers.

## Attachment personal data handling

- [ ] Treat uploaded photos, PDFs, and free-form text files as citizen personal data.
- [x] Public ticket responses expose only safe attachment metadata: id, file name, MIME type, size, timestamp, and scan status.
- [x] Public responses never expose storage keys, presigned upload URLs after initiation, audit logs, internal notes, AI reasoning, staff-only fields, or permanent object URLs.
- [x] Signed download URLs use short TTL (`S3_DOWNLOAD_EXPIRES_SECONDS`) and are generated only after tenant/tracking-token or staff RBAC checks.
- [x] Release notes identify attachment retention as implemented with dry-run default; export remains a separate future product requirement.
