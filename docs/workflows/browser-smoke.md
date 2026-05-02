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

### Scenario A — Admin login

1. Open `http://127.0.0.1:3111/login`.
2. Submit the seeded login.
3. Confirm redirect away from login to the admin dashboard.
4. Confirm an HTTP-only local MVP session cookie exists.
5. Confirm the dashboard renders operational cards and does not expose raw API errors.

### Scenario B — Dashboard, reports, and queues operational smoke

1. Open `http://127.0.0.1:3111/` after login.
2. Confirm dashboard KPI cards render with labels, values, and safe empty/default states; no raw API errors should be visible.
3. Open `http://127.0.0.1:3111/reports` and confirm empty, data, loading, and error states are operationally useful for managers.
4. Confirm reports copy distinguishes "no data yet" from "data failed to load" and offers a next step when possible.
5. Open `http://127.0.0.1:3111/queues` and confirm queue copy explains operational ownership, next action, or current limitation without generic filler.
6. Confirm queues show SLA/workload context clearly enough for a staff operator to decide what to open next.
7. Set the viewport near 390px width and quickly recheck dashboard, reports, and queues for clipped KPI values, hidden actions, or horizontal scrolling.

### Scenario C — Admin ticket list

1. Open `http://127.0.0.1:3111/tickets`.
2. Confirm either real ticket rows or the designed empty state renders.
3. If rows render, confirm visible ticket metadata is staff-safe and tenant-scoped.
4. Open a ticket detail page from the list.

### Scenario D — Ticket detail mutation forms

1. Assign the ticket to a visible department and confirm a specific success notice.
2. Add an internal note and confirm it appears only in the admin timeline.
3. Add a public message and confirm the admin page records it separately from internal notes.
4. Refresh the ticket detail page and confirm assignment, notes, messages, and notices persist or clear intentionally.
5. Trigger one validation or authorization-style error path and confirm the error notice is actionable without exposing raw backend payloads.

### Scenario E — Status transition disabled and guarded states

1. Review the visible next status actions for the ticket's current status.
2. Confirm invalid transitions are hidden, disabled, or guarded by explanatory copy.
3. Execute one valid transition and confirm a specific success notice.
4. Refresh the page and confirm the new status persists.
5. Confirm repeated or now-invalid transitions cannot be submitted accidentally.

### Scenario F — Audit timeline

1. After assignment, note, public message, and status transition, inspect the audit timeline.
2. Confirm each mutation has a visible audit event with actor, action, and timestamp context.
3. Confirm internal notes and audit details do not appear in citizen-facing pages.
4. Confirm audit timeline failures do not collapse the whole ticket detail page into a raw error.

### Scenario G — Settings notices

1. Open `http://127.0.0.1:3111/settings`.
2. Create a department with a unique local smoke code, for example `QA-<date>-<initials>`.
3. Update that department name or description, then disable it.
4. Create a category under an enabled department, then update or disable it.
5. Create or update an SLA policy.
6. Edit one message template and refresh the page to confirm persistence.
7. Confirm each successful settings mutation shows a specific success notice.
8. Confirm validation or authorization failures show actionable error notices without stack traces, tokens, or raw internal errors.

Admin expected markers:

- Settings writes are accepted only for a seeded admin role with `TENANT_ADMIN` or `SUPER_ADMIN` privileges.
- Settings rows stay tenant-scoped to `demo-belediye`.
- Ticket assignment, internal note, public message, status transition, and audit log are visible in the admin flow.
- Success/error notices are specific, persistent enough to read, and do not leak secrets, stack traces, or raw backend payloads.

### Scenario H — Role-aware admin UI controls

1. Login as a read-only seeded user if available for local smoke.
2. Open dashboard, ticket list, ticket detail, and settings pages.
3. Confirm read-only pages still render useful data or designed empty states without raw authorization errors.
4. Confirm mutation controls are hidden, disabled, or guarded with clear copy for read-only users.
5. Attempt one guarded action only if the UI exposes it; confirm the denial notice is specific, non-scary, and does not expose stack traces, tokens, role internals, or raw API payloads.
6. Repeat a spot check with `DEPARTMENT_STAFF` if seeded credentials are available: assigned-department actions may appear, cross-department or admin-only actions must be hidden, disabled, or denied safely.
7. Return to `TENANT_ADMIN` and confirm allowed mutation controls still work, so role restrictions did not break the happy path.

## Citizen smoke

### Scenario I — Citizen report

1. Open `http://127.0.0.1:3112/demo-belediye/report`.
2. Submit a report with realistic Turkish description, address, and phone.
3. Confirm redirect to `/demo-belediye/ticket/<ticketNo>`.
4. Record the generated ticket number for the QA report.
5. Confirm the report flow works without staff authentication.
6. Confirm required-field validation copy is Turkish-first and does not expose backend internals.

### Scenario J — Citizen track

1. Open `http://127.0.0.1:3112/demo-belediye/track`.
2. Enter the same ticket number and confirm navigation to the same public ticket page.
3. Submit the tracking form with a missing ticket number and confirm inline copy explains what is required.
4. Submit a malformed ticket number and confirm the format error is calm, Turkish-first, and does not leak lookup internals.
5. Try an obviously invalid but well-formed ticket number and confirm the not-found state is citizen-safe and helpful.
6. Reopen the valid ticket page after the invalid states and confirm the successful state still renders correctly.

### Scenario K — Citizen public ticket status copy

1. Confirm the public ticket page shows only public-safe fields: ticket number, status, category/department if public, address/description summary if intended, and citizen-safe messages.
2. Confirm status copy is understandable to a citizen and avoids internal workflow jargon.
3. Confirm loading, empty, invalid, and error states explain what the citizen can do next.
4. Confirm the page does not show internal notes, audit logs, staff-only metadata, AI reasoning, tokens, stack traces, or tenant internals.

### Scenario L — Mobile viewport quick check

1. Set the viewport near 390px width.
2. Recheck admin login, settings, ticket detail, citizen report, citizen track, and citizen ticket pages.
3. Confirm primary actions remain reachable without horizontal scrolling.
4. Confirm notices, validation messages, and status copy do not cover form controls or navigation.
5. Confirm focus-visible and keyboard navigation still work for login, ticket forms, and settings forms.

Citizen expected markers:

- Citizen copy is Turkish-first, calm, and public-safe.
- Tracking requires the ticket number and never exposes another tenant's internal data.
- Empty, loading, invalid, and error states are understandable without raw backend payloads.

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
