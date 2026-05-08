# Netiva AI Provider

KentOS can use Netiva's OpenAI-compatible API for public intake classification without storing API keys in the repository.

## Enable Locally

Set these values in your local `.env` file:

```bash
AI_PROVIDER=netiva
NETIVA_BASE_URL=https://api.netiva.com.tr/v1
NETIVA_API_KEY=
NETIVA_MODEL=claude-sonnet-4-6
```

`NETIVA_API_KEY` takes priority. If it is empty, the API falls back to `AI_API_KEY`.

## Safety Behavior

- No key is committed to the repo.
- `AI_PROVIDER=stub` keeps the current deterministic fallback and makes tests/smoke runs independent from paid or external AI calls.
- If Netiva returns an error, times out, or returns invalid JSON, public ticket creation falls back to deterministic classification.
- The model output is accepted only after it passes the shared `intakeClassificationSchema`.

## Verification

Use static verification before enabling a real key:

```bash
pnpm --filter @kentos/shared test
pnpm --filter @kentos/api typecheck
pnpm typecheck
pnpm build
```

Run a real Netiva classification only after API key and budget approval.
