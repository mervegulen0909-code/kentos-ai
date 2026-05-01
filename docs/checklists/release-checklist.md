# Release Checklist

## Required checks

- [ ] `pnpm db:generate`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] API health endpoint responds locally.
- [ ] Admin web renders primary dashboard route.
- [ ] Citizen web renders report and tracking routes.
- [ ] Ticket mutations create audit logs.
- [ ] Citizen-facing endpoints do not expose internal notes or AI reasoning.
- [ ] No hardcoded secrets or production credentials.

## Manual smoke checks

- [ ] Login as seeded admin.
- [ ] Create a manual ticket.
- [ ] Assign ticket to department/user.
- [ ] Add internal note.
- [ ] Add public message.
- [ ] Change status to in progress, resolved, and closed.
- [ ] Track a ticket from citizen route.
