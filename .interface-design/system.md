# KentOS AI Active Interface System

## Current direction

- Admin UI: data-dense operational noir with green civic accent and red SLA breach emphasis.
- Citizen UI: editorial civic warmth with large display typography and simple form-first flow.

## Current patterns

### Admin shell

- Two-column layout: fixed sidebar + wide operational main area.
- KPI cards use large numeric display and compact labels.
- Ticket queues use scan-friendly rows with ticket number, issue, department, SLA, and status.

### Citizen shell

- Split hero + form on desktop, single column on mobile.
- Copy is direct and Turkish-first.
- Form fields are stacked with explicit labels.

## Implementation decisions

- CSS custom properties define tokens locally until shared UI package matures.
- Use `oklch()` and `color-mix()` for perceptual color consistency.
- Keep admin and citizen visual systems related but not identical.

## Open design work

- Add componentized button, field, badge, and ticket row primitives.
- Add explicit skeleton/empty/error components.
- Add map/location picker once Leaflet is introduced.
