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
- [ ] Signed URLs are used for private object access.

## Channel security

- [ ] WhatsApp gateway uses internal auth when calling API.
- [ ] Meta Cloud API webhook signatures are verified before production use.
- [ ] Baileys remains demo/local only.
