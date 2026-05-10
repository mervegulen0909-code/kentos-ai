# Security and KVKK Checklist

## Data minimization

- [ ] Store only necessary citizen contact data.
- [ ] Keep internal notes separate from public messages.
- [ ] Do not expose AI reasoning to citizens.
- [ ] Keep export/delete readiness in model and API design.

## Access control

- [ ] Every staff/admin endpoint is tenant scoped.
- [ ] RBAC guards protect privileged actions.
- [ ] Department staff cannot access unrelated department queues unless role allows it.

## Auditability

- [ ] Ticket create/status/assign/note/public message/resolve/close actions write audit logs.
- [ ] Audit logs include actor, action, timestamp, and before/after where relevant.

## Input and upload safety

- [ ] DTOs validate request input.
- [ ] File uploads validate MIME, size, and storage key.
- [ ] Presigned upload responses do not expose internal storage keys.
- [ ] Attachment confirm requires a SHA-256 checksum before ticket/message binding.
- [ ] Confirmed attachments can be linked only within the same tenant and expected actor scope.
- [ ] Closed/rejected tickets reject new attachment upload, confirm, or binding attempts.
- [ ] Private object access uses signed download endpoints instead of permanent public object URLs.
- [ ] Media processor evidence records object metadata checks; virus scanning remains a documented placeholder until a scanning provider is approved.

## Channel security

- [ ] WhatsApp gateway uses internal auth when calling API.
- [ ] Meta Cloud API webhook signatures are verified before production use.
- [ ] Instagram + Facebook webhook signatures (`X-Hub-Signature-256` / `META_APP_SECRET`) are verified before LIVE outbound flag is enabled for that channel.
- [ ] Twilio SMS webhook signatures (`X-Twilio-Signature` / `TWILIO_AUTH_TOKEN`) are verified before LIVE outbound flag is enabled.
- [ ] Each channel `*_OUTBOUND_LIVE=true` toggle is reviewed by tenant operator before enabling and recorded in the run-log.
- [ ] Baileys remains demo/local only.

## Multi-channel outbound (Faz 4 + Faz 7)

- [ ] `OutboundDelivery` retention is bounded by the retention worker (default 90 days, terminal states only).
- [ ] `OutboundDelivery.body` does not include unmasked national IDs; PII helpers in `@kentos/shared` (`maskPii`, `safeLogString`) are used in any structured log emission downstream of the dispatcher.
- [ ] Outbound dispatcher writes `channel.outbound_enqueued` / `channel.outbound_enqueue_failed` audit log per delivery.
- [ ] Outbound retry uses exponential backoff with bounded `attempts`; failed deliveries leave `lastError` for review.

## Rate limit and abuse

- [ ] Public widget channel uses Redis-backed rate limit when `REDIS_URL` is configured; in-memory fallback is restricted to local dev.
- [ ] Tenant `widgetAllowedOrigins` is the source of truth; env `WIDGET_ORIGIN_ALLOWLIST` is operational override only.
- [ ] `/public/:tenantSlug/widget-status` is safe to expose: it does not reveal allowlist contents, only count and per-origin allowed boolean.

## Retention and KVKK lifecycle

- [ ] Retention worker (`kentos.retention`) is scheduled (or invoked manually per release) for each scope: `channel-events`, `outbound-deliveries`, `audit-logs`, `conversations`.
- [ ] Attachment retention is either included in the retention processor scope or explicitly marked out of scope with owner/SLA before release.
- [ ] Per-tenant retention overrides are documented; default retention windows recorded in run-log.
- [ ] Citizen identity merges/imports keep the audit trail and do not silently drop prior identifiers.

## Attachment personal data handling

- [ ] Treat uploaded photos, PDFs, and free-form text files as citizen personal data.
- [ ] Public ticket responses expose only safe attachment metadata: id, file name, MIME type, size, and timestamp.
- [ ] Public responses never expose storage keys, presigned upload URLs after initiation, audit logs, internal notes, AI reasoning, staff-only fields, or permanent object URLs.
- [ ] Signed download URLs use short TTL (`S3_DOWNLOAD_EXPIRES_SECONDS`) and are generated only after tenant/tracking-token or staff RBAC checks.
- [ ] Release notes identify whether attachment retention/delete/export handling is implemented or remains a follow-up.
