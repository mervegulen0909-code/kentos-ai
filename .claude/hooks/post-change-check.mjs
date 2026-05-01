#!/usr/bin/env node

const changedHint = process.env.CLAUDE_FILE_PATHS ?? '';

if (/apps\\api|apps\/api|packages\\database|packages\/database/.test(changedHint)) {
  console.log('KentOS hint: backend/database files changed; run pnpm --filter @kentos/api typecheck and pnpm db:generate when appropriate.');
}

if (/apps\\admin-web|apps\/admin-web/.test(changedHint)) {
  console.log('KentOS hint: admin-web files changed; run pnpm --filter @kentos/admin-web typecheck && pnpm --filter @kentos/admin-web build.');
}

if (/apps\\citizen-web|apps\/citizen-web/.test(changedHint)) {
  console.log('KentOS hint: citizen-web files changed; run pnpm --filter @kentos/citizen-web typecheck && pnpm --filter @kentos/citizen-web build.');
}
