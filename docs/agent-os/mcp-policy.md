# MCP Policy

MCP extends Claude Code with external tools. KentOS uses a strict read-first policy.

## Allowed

- Documentation lookup for frameworks and SDKs.
- Read-only GitHub issue/PR lookup when user authorizes access.
- Local Docker PostgreSQL inspection for development only.
- Context retrieval that does not upload secrets or production data.

## Approval required

- Any write to external systems.
- Any paid API/model call.
- Any production system access.
- Any operation that may publish, send, deploy, or notify people.

## Repo files

`.claude/mcp/README.md` describes policy only. Do not commit MCP credentials or user-specific tokens.
