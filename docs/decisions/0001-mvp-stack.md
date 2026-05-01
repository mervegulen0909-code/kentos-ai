# 0001 — MVP Stack Decision

## Decision

KentOS AI MVP uses a TypeScript monorepo with:

- NestJS API
- PostgreSQL + Prisma
- Redis/BullMQ worker boundary
- Next.js admin web
- Next.js citizen web
- Separate WhatsApp gateway provider adapter
- Separate AI service provider/prompt boundary
- S3-compatible storage

## Why

The product is workflow-heavy and tenant-scoped. NestJS gives structured modules, guards, DTOs, OpenAPI support, and service boundaries. Prisma keeps the tenant-aware schema explicit and migration-friendly. Next.js allows admin and citizen surfaces to share TypeScript contracts while evolving separately.

## Consequences

- Business logic lives in `apps/api`, not in web apps or the WhatsApp gateway.
- WhatsApp transport stays swappable between Baileys demo and Meta Cloud API production.
- Municipality-specific departments/categories/SLA policies are seed/config data, not hardcoded routing logic.
- All tenant data access must be scoped and reviewed.
