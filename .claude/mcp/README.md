# MCP Policy for KentOS AI

MCP servers are allowed only when they improve local development safety or documentation accuracy.

## Recommended MCP categories

- Documentation lookup: framework docs, package docs, API references.
- GitHub read-only project/issue inspection, if authenticated by the user.
- Local database inspection for local Docker PostgreSQL only.

## Forbidden MCP usage

- Production database access.
- Secrets vault mutation.
- External message sending.
- Paid model/API calls without explicit approval.
- Broad web automation that uploads private code or data.

## Config rule

Do not commit secrets or user tokens. Keep user-specific MCP credentials in local/user settings, not repo files.

## Usage pattern

Before using an MCP tool:

1. State what source will be queried.
2. Prefer read-only operation.
3. Summarize results in Turkish.
4. Do not paste raw secret-bearing output into chat or docs.
