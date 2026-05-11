# Municipality Widget Integration

KentOS citizen intake can be embedded into a municipality homepage with one script tag. The script renders a floating launcher and opens the tenant widget in an iframe.

## Prerequisites

- `MUNICIPALITY_DOMAIN` must point to the KentOS VPS.
- The citizen web app must be reachable at `PUBLIC_CITIZEN_BASE_URL`.
- The tenant must be active and `widgetEnabled=true`.
- The municipality homepage origin must be listed in the tenant `widgetAllowedOrigins`.

## Demo Municipality Site

For a spare domain, set these values in `.env.production.local`:

```bash
MUNICIPALITY_DOMAIN=www.example.gov.tr
DEFAULT_TENANT_SLUG=demo-belediye
PUBLIC_CITIZEN_BASE_URL=https://citizen.example.gov.tr
WIDGET_ORIGIN_ALLOWLIST=https://citizen.example.gov.tr,https://www.example.gov.tr
```

`infra/Caddyfile.prod` serves a simple municipality homepage on `MUNICIPALITY_DOMAIN` and embeds the widget script automatically.

## Script Tag

Use the install code from Admin > Settings > Web asistani kurulumu. For production it should look like:

```html
<script
  src="https://citizen.example.gov.tr/widget.js"
  data-tenant="demo-belediye"
  data-label="Belediye asistani"
  async
></script>
```

Place it just before the closing `</body>` tag on the municipality homepage.

## Verification

1. Add the homepage origin in widget settings, for example `https://www.example.gov.tr`.
2. Run the widget connection test from the admin settings page with that exact origin.
3. Open the municipality homepage and confirm the launcher appears.
4. Submit a short test message and confirm it creates or continues a `WEB_CHAT` conversation.

## Common Issues

- If the launcher does not appear, verify the script URL is absolute and points to citizen-web, not admin-web.
- If submission fails, verify the API base URL and tenant allowlist.
- If the iframe is blocked, check the municipality CMS CSP/frame/script restrictions and allow the citizen-web origin.
