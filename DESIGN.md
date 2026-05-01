# KentOS AI Design Contract

```yaml
brand:
  name: KentOS AI
  direction: data-dense municipal operations with warm citizen trust
  tone:
    - operational
    - calm
    - accountable
    - Turkish-first
color:
  admin:
    bg: "oklch(16% 0.018 252)"
    surface: "oklch(22% 0.022 252)"
    elevated: "oklch(28% 0.026 252)"
    text: "oklch(94% 0.012 255)"
    muted: "oklch(72% 0.025 255)"
    line: "oklch(34% 0.03 252)"
    accent: "oklch(74% 0.18 151)"
    danger: "oklch(68% 0.2 28)"
  citizen:
    bg: "oklch(96% 0.018 92)"
    surface: "oklch(100% 0 0)"
    ink: "oklch(21% 0.032 72)"
    muted: "oklch(48% 0.036 72)"
    line: "oklch(86% 0.028 86)"
    accent: "oklch(62% 0.17 38)"
typography:
  admin:
    family: "Bricolage Grotesque, Aptos, system-ui, sans-serif"
    displayTracking: "-0.06em"
  citizen:
    family: "Fraunces, Charter, Georgia, serif"
    displayTracking: "-0.07em"
radius:
  input: 14
  card: 22
  citizenCard: 28
  pill: 999
components:
  ticketCard:
    states: [default, hover, focus-visible, selected, loading, empty, error]
  formField:
    states: [default, focus-visible, disabled, error, success]
  slaBadge:
    states: [safe, warning, breached]
```

## Rationale

KentOS AI needs two related but distinct experiences:

- **Admin/staff:** a dark, command-center interface that highlights queues, SLA risk, department ownership, and operational throughput.
- **Citizen:** a warmer civic-service interface that feels trustworthy, direct, and accessible to non-technical users.

The UI should avoid generic startup gradients and decorative chatbot tropes. It should feel like municipal infrastructure: accountable, legible, and fast under pressure.

## Design requirements

- Turkish copy is first-class.
- Every interactive control must have visible focus states.
- Forms use labels, not placeholder-only labels.
- Ticket/SLA state must never rely on color alone.
- Admin pages should support dense scanning.
- Citizen pages should keep the next action obvious.
- Loading, empty, error, disabled, hover, focus, and active states are required for production-facing components.
