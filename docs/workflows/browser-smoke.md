# Browser Smoke Workflow

## Start local services

```bash
docker compose -f infra/docker-compose.yml up -d
DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' pnpm db:seed
DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' PORT=3110 pnpm --filter @kentos/api dev
NEXT_PUBLIC_API_BASE_URL='http://localhost:3110/api/v1' pnpm --filter @kentos/admin-web dev -- -p 3111
NEXT_PUBLIC_API_BASE_URL='http://localhost:3110/api/v1' pnpm --filter @kentos/citizen-web dev -- -p 3112
```

## Admin smoke

1. Open `http://localhost:3111/login`.
2. Login with:
   - Tenant: `demo-belediye`
   - Email: `admin@demo.local`
   - Password: `ChangeMe123!`
3. Confirm redirect to dashboard.
4. Open `/tickets` and confirm real ticket rows or empty state render.
5. Open a ticket detail from the list.
6. Add an internal note.
7. Add a public message.
8. Assign the ticket to a department.
9. Change status to one of the visible valid next transitions.
10. Confirm audit timeline updates.
11. Open `/settings`.
12. Create a department with a unique code.
13. Update or disable a department.
14. Create a category under that department.
15. Update or disable a category.
16. Create or update an SLA policy.
17. Edit one message template and confirm it persists after refresh.

## Citizen smoke

1. Open `http://localhost:3112/demo-belediye/report`.
2. Submit a report with description, address, and phone.
3. Confirm redirect to `/demo-belediye/ticket/<ticketNo>`.
4. Confirm public-safe ticket status renders.
5. Open `http://localhost:3112/demo-belediye/track`.
6. Enter the same ticket number.
7. Confirm navigation to the same ticket page.

## Expected markers

- API `/health` and `/health/ready` return 200.
- Admin login creates an HTTP-only local MVP cookie.
- Citizen pages never show internal notes, audit logs, or AI reasoning.
- Settings writes require a `TENANT_ADMIN` or `SUPER_ADMIN` role and create tenant-scoped rows only for the logged-in tenant.
- Ticket mutation smoke covers assignment, internal note, public message, status transition, and audit log entries.

## Known limitations

- Auth/session is local MVP, not production SSO.
- No file upload or map picker yet.
- Browser flow is currently manual; automated Playwright/Cypress can be added in a later wave.
