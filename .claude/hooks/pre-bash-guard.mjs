#!/usr/bin/env node

const input = await new Promise((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => { data += chunk; });
  process.stdin.on('end', () => resolve(data));
});

const blocked = [
  /rm\s+-rf/i,
  /\brm(?:\.exe)?\b\s+-(?:[^\s]*r|[^\s]*R|recursive\b)/i,
  /\b(rmdir|rd)(?:\.exe)?\b\s+.*\/s\b/i,
  /git\s+reset\s+--hard/i,
  /git\s+restore\b/i,
  /git\s+rm\b/i,
  /git\s+push\s+--force/i,
  /drop\s+database/i,
  /docker\s+compose\s+down\s+-v/i,
  /\bremove-item\b/i,
  /\b(del|erase)\b/i,
  /\bstop-process\b/i,
  /\bcurl(?:\.exe)?\b\s+.*https?:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/i,
  /\b(invoke-webrequest|invoke-restmethod|iwr|irm|wget)(?:\.exe)?\b\s+.*https?:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/i,
];

if (blocked.some((pattern) => pattern.test(input))) {
  console.error('Blocked by KentOS pre-bash guard: destructive, external, or approval-gated command detected.');
  process.exit(2);
}

process.exit(0);
