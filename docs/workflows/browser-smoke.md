# Browser Smoke Workflow

This checklist verifies the real admin and citizen browser flows against a local API. It is manual today; do not report UI work as complete unless this checklist was run or the final report explicitly says browser smoke was not run.

## Start local services

Start infrastructure and seed the demo tenant:

```bash
docker compose -f infra/docker-compose.yml up -d
DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' pnpm db:generate
DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' pnpm db:migrate
DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' pnpm db:seed
```

Start API, admin web, and citizen web on QA ports:

```bash
DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' PORT=3110 pnpm --filter @kentos/api dev
NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:3110/api/v1' pnpm --filter @kentos/admin-web dev -- -p 3111
NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:3110/api/v1' pnpm --filter @kentos/citizen-web dev -- -p 3112
```

Expected local URLs:

- API docs: `http://127.0.0.1:3110/api/docs`
- Admin web: `http://127.0.0.1:3111`
- Citizen web: `http://127.0.0.1:3112/demo-belediye/report`

## Preflight API smoke

Run API smoke before browser smoke so browser failures are easier to isolate:

```bash
KENTOS_API_BASE_URL='http://127.0.0.1:3110/api/v1' pnpm smoke:api
```

Continue to browser smoke only if API health, login, tenant settings, ticket mutations, audit log, and public create/track checks pass.

## Admin smoke

Seeded login:

- Tenant: `demo-belediye`
- Email: `admin@demo.local`
- Password: `ChangeMe123!`

Checklist:

1. Open `http://127.0.0.1:3111/login`.
2. Submit the seeded login and confirm redirect away from login to the admin dashboard.
3. Confirm the dashboard renders operational cards and does not expose raw API errors.
4. Open `http://127.0.0.1:3111/tickets`.
5. Confirm either real ticket rows or the designed empty state renders.
6. Open a ticket detail page from the list.
7. Assign the ticket to a visible department.
8. Add an internal note and confirm it appears only in the admin timeline.
9. Add a public message and confirm the admin page records it.
10. Change status using one of the visible valid next transitions.
11. Refresh the ticket detail page and confirm status, assignment, notes/messages, and audit timeline persist.
12. Open `http://127.0.0.1:3111/settings`.
13. Create a department with a unique local smoke code, for example `QA-<date>-<initials>`.
14. Update that department name or description, then disable it.
15. Create a category under an enabled department.
16. Update or disable that category.
17. Create or update an SLA policy.
18. Edit one message template and refresh the page to confirm persistence.
19. Trigger at least one successful admin mutation and confirm the success notice is specific and visible after navigation or refresh when intended.
20. Trigger one validation or authorization-style error path and confirm the error notice is actionable without exposing raw backend payloads.

Admin expected markers:

- Login creates an HTTP-only local MVP session cookie.
- Settings writes are accepted only for a seeded admin role with `TENANT_ADMIN` or `SUPER_ADMIN` privileges.
- Settings rows stay tenant-scoped to `demo-belediye`.
- Ticket assignment, internal note, public message, status transition, and audit log are visible in the admin flow.
- Errors are actionable and do not leak stack traces, raw internal errors, secrets, or tokens.

## Citizen smoke

Checklist:

1. Open `http://127.0.0.1:3112/demo-belediye/report`.
2. Submit a report with realistic Turkish description, address, and phone.
3. Confirm redirect to `/demo-belediye/ticket/<ticketNo>`.
4. Record the generated ticket number for the QA report.
5. Confirm the public ticket page shows only public-safe fields: ticket number, status, category/department if public, address/description summary if intended, and citizen-safe messages.
6. Confirm the page does not show internal notes, audit logs, staff-only metadata, AI reasoning, tokens, stack traces, or tenant internals.
7. Open `http://127.0.0.1:3112/demo-belediye/track`.
8. Enter the same ticket number and confirm navigation to the same public ticket page.
9. Try an obviously invalid ticket number and confirm the error state is citizen-safe and helpful.
10. Submit the tracking form with a missing ticket number and confirm inline copy explains what is required.
11. Submit a malformed ticket number and confirm the format error is calm, Turkish-first, and does not leak lookup internals.
12. Reopen the valid ticket page after the invalid states and confirm the successful state still renders correctly.

Citizen expected markers:

- Citizen copy is Turkish-first, calm, and public-safe.
- The report flow works without staff authentication.
- Tracking requires the ticket number and never exposes another tenant's internal data.
- Empty, loading, and error states are understandable without raw backend payloads.

## Regression checks

During the smoke, also watch for:

- Browser console errors on admin and citizen pages.
- Failed network requests that are not expected validation failures.
- Layout breakage on a narrow mobile viewport.
- Mobile viewport quick check around 390px width for admin login/settings/ticket detail and citizen report/track/ticket pages.
- Forms that submit twice, stay stuck in loading state, or lose validation feedback.
- Focus-visible state and keyboard navigation for login, ticket forms, and settings forms.

## Known limitations

- Auth/session is local MVP, not production SSO.
- File upload, map picker, WhatsApp send, and external notification delivery are not part of this browser smoke.
- The browser flow is manual until a later automated Playwright/Cypress wave.
