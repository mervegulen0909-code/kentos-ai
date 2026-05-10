# KentOS UI Refresh Prompt Package

Use this package to generate the visual direction first, then hand the repo-aware implementation brief to Claude Design.

## Imagine 2 Visual Set Prompt

```text
Create a cohesive visual direction set for "KentOS AI", a Turkish municipal operations and citizen request platform.

Generate a 5-image design moodboard, not final UI code.

Image 1: desktop municipal operations dashboard.
A calm, dense, professional admin workspace for city staff. Left navigation, ticket queue, SLA status, assigned department, urgent actions. Clear hierarchy, compact rows, no clutter, no oversized marketing hero. Modern public-service software, light interface, warm off-white surfaces, deep teal action color, muted blue-gray text, soft green success state, restrained red alert state. Use placeholder UI blocks, no readable text.

Image 2: ticket detail workflow.
A single request detail page with a prominent status/action column, timeline, public messages, internal notes clearly separated, AI intake summary visually secondary. Make actions easy to find: assign, update status, request info, resolve. Use large tap targets, clean spacing, accessible contrast, no nested cards, no tiny text.

Image 3: citizen mobile request form.
A friendly public-facing municipal form on a phone. Big readable form fields, short helper copy, map/location picker, submit button, progress reassurance. Calm trustworthy civic tone, simple Turkish municipality feeling without official emblems. No readable text, only placeholder bars.

Image 4: citizen tracking page.
A public tracking screen showing ticket status, timeline updates, tracking code, department, resolution status. Warm, reassuring, very legible. Separate citizen-visible messages from private internal notes. Mobile-first but also adaptable to desktop.

Image 5: design system board.
Typography scale, spacing, buttons, status chips, form fields, list rows, timeline markers, notification states. Use a mature civic SaaS style: Inter-like typography, 8px radii, clear status colors, restrained shadows, no gradient blobs, no decorative orbs, no busy cards.

Art direction:
- Turkish municipal operations, trustworthy, practical, modern.
- Utility-first, not marketing.
- Light theme, high readability.
- Avoid purple gradients, beige-heavy palette, dark dashboard cliche, glassmorphism, neumorphism.
- Use real interface composition but no legible words, no logos, no fake official seals.
- The design must feel easy for non-technical municipal staff and citizens.
```

## Claude Design Repo Prompt

```text
You are redesigning the UI/UX of the KentOS AI repo.

Repository context:
- Workspace: C:\Users\arfgl\OneDrive\Desktop\chatbot
- Stack: pnpm workspaces, Next.js App Router admin-web and citizen-web, NestJS API, Prisma.
- Main UI paths:
  - apps/admin-web/app/**
  - apps/admin-web/app/globals.css
  - apps/citizen-web/app/**
  - apps/citizen-web/app/globals.css
- Do not change backend workflow/auth/business logic unless a UI type mismatch forces a tiny compile fix.
- Do not push, deploy, change secrets, or delete data.

Goal:
Make the product much easier to use. Current UI has uneven text sizing, too many same-weight cards, technical Turkish copy, mojibake/encoding issues, weak visual hierarchy, and crowded ticket detail actions. Redesign the admin and citizen surfaces into a calmer, more readable municipal operations system.

Design principles:
- Admin is an operational tool, not a landing page.
- Citizen screens should be friendly, simple, mobile-first, and reassuring.
- Use correct Turkish characters everywhere: "Başvuru", "Çözüm", "İşlemde", "Vatandaş", "Atanmamış", "SLA içinde".
- Prefer short utility copy over long explanations.
- Make the primary next action obvious on every screen.
- Keep cards only where they frame a real interaction; avoid card mosaics.
- Use stable responsive dimensions so buttons, labels, rows, and forms do not shift or overlap.
- Use 8px radii or less for app UI unless a component clearly needs more.
- Do not add decorative gradient blobs, orbs, bokeh, fake illustrations, or marketing hero sections.
- Do not hide important controls below the fold when the page opens on common laptop sizes.

Admin redesign requirements:
- Dashboard:
  - Replace marketing-like heading with compact operational overview.
  - Show KPIs, priority queue, and navigation in a scannable layout.
  - Labels should be plain: "Açık talepler", "SLA aşımı", "Bugün çözülen", "Öncelikli kuyruk".
- Ticket list:
  - Make it feel like a proper queue/table hybrid.
  - Improve row density and status scanning.
  - Add visible labels on mobile, stable columns on desktop.
- Ticket detail:
  - Restructure hierarchy around:
    1. ticket identity/status summary,
    2. primary workflow actions,
    3. citizen-visible communication,
    4. internal notes/audit,
    5. AI intake as supporting context.
  - Make "Durum", "Atama", and "Hızlı aksiyonlar" easier to understand.
  - Prevent accidental action confusion between "Bilgi iste" and "Çözüm bildir".
  - If a ticket is RESOLVED or CLOSED, show terminal state clearly and disable unsupported actions with explanatory copy.
  - Internal notes must visually differ from citizen messages.
- Copy:
  - Replace technical wording like "session cookie akışı", "RBAC kapsamı", "API guard" with staff-friendly Turkish.
  - Keep operational accuracy but avoid exposing implementation details to staff.

Citizen redesign requirements:
- Report page:
  - Make the form feel simpler and less intimidating.
  - First screen should clearly show what to write, where to add location, and how tracking works.
  - Keep optional contact fields clear.
  - Location picker must remain usable on mobile.
- Tracking page:
  - Make current status the dominant element.
  - Timeline should be easy to scan and clearly citizen-safe.
  - Tracking code should be easy to copy/read.
  - Do not show internal notes or staff-only reasoning.
- Widget:
  - Keep it compact, readable, and clearly connected to official request flow.

Implementation constraints:
- Keep existing routes and server actions.
- Preserve auth/session behavior and ticket workflow behavior.
- Keep existing API contracts.
- Use existing CSS files unless a small component-level CSS extraction is clearly cleaner.
- Do not add a new UI framework.
- Do not introduce new external dependencies unless absolutely necessary; prefer plain CSS/React.
- Keep TypeScript strict and build passing.

Deliverables:
1. A concise UI redesign patch plan grouped by admin-web and citizen-web.
2. Then implement the patch.
3. After implementation, run:
   - pnpm --filter @kentos/admin-web typecheck
   - pnpm --filter @kentos/citizen-web typecheck
   - pnpm typecheck
   - pnpm build
4. Smoke manually or with Playwright:
   - Admin login at http://127.0.0.1:3101/login
   - Admin ticket list and detail
   - Citizen report page
   - Citizen tracking page
5. Report changed files, verification results, and any remaining UX risk.

Acceptance criteria:
- Turkish copy renders correctly with no mojibake.
- Text is readable on desktop and mobile.
- Admin ticket detail actions are obvious and not confusing.
- Citizen form and tracking can be understood without explanation.
- No overlapping text, clipped buttons, or hidden primary controls at common laptop/mobile widths.
- No backend regressions.
```

## Usage Notes

- Use the Imagine 2 prompt first to get visual direction references.
- Use the Claude Design prompt after selecting the direction that feels most practical and readable.
- Treat generated moodboard images as direction only; do not copy unreadable placeholder text into the product.
- The target is not a flashy redesign. The target is fast, clear municipal work for staff and citizens.
