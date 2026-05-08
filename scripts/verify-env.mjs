#!/usr/bin/env node
// scripts/verify-env.mjs
//
// KentOS AI - tekrarlanabilir dogrulama dizisi.
// Bu script, plan-uretim-hazirlik-raporu.md'deki tum yerel dogrulama adimlarini
// sirayla calistirir, her adimin pass/fail durumunu yakalar ve sonucta
// `verification-report.txt` dosyasini uretir.
//
// Kullanim:
//   node scripts/verify-env.mjs            # tum adimlari calistir
//   node scripts/verify-env.mjs --skip db  # 'db' etiketli adimlari atla
//   node scripts/verify-env.mjs --only typecheck,build
//
// Cikis kodu: tum adimlar passed = 0, herhangi bir failed varsa 1.

import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_PATH = path.join(REPO_ROOT, 'verification-report.txt');

const STEPS = [
  {
    id: 'pnpm-version',
    label: 'pnpm sürümü',
    tags: ['env'],
    command: 'pnpm',
    args: ['--version'],
  },
  {
    id: 'node-version',
    label: 'node sürümü',
    tags: ['env'],
    command: 'node',
    args: ['--version'],
  },
  {
    id: 'install',
    label: 'pnpm install (workspace)',
    tags: ['install'],
    command: 'pnpm',
    args: ['install', '--frozen-lockfile=false'],
  },
  {
    id: 'db-generate',
    label: 'pnpm db:generate (Prisma client)',
    tags: ['db'],
    command: 'pnpm',
    args: ['db:generate'],
  },
  {
    id: 'typecheck',
    label: 'pnpm typecheck (recursive)',
    tags: ['static'],
    command: 'pnpm',
    args: ['typecheck'],
  },
  {
    id: 'build',
    label: 'pnpm build (recursive)',
    tags: ['static'],
    command: 'pnpm',
    args: ['build'],
  },
  {
    id: 'whatsapp-test',
    label: 'WhatsApp gateway unit testleri',
    tags: ['test', 'gateway'],
    command: 'pnpm',
    args: ['--filter', '@kentos/whatsapp-gateway', 'test'],
  },
  {
    id: 'shared-test',
    label: 'shared package testleri',
    tags: ['test'],
    command: 'pnpm',
    args: ['--filter', '@kentos/shared', 'test'],
    optional: true,
  },
  {
    id: 'worker-typecheck',
    label: 'worker typecheck',
    tags: ['static', 'worker'],
    command: 'pnpm',
    args: ['--filter', '@kentos/worker', 'typecheck'],
  },
];

const args = process.argv.slice(2);
const skipFlag = takeFlag('--skip');
const onlyFlag = takeFlag('--only');
const skipSet = new Set(splitCsv(skipFlag));
const onlySet = onlyFlag ? new Set(splitCsv(onlyFlag)) : null;

function takeFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) return null;
  return value;
}

function splitCsv(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function shouldRun(step) {
  if (onlySet && !onlySet.has(step.id) && !step.tags.some((tag) => onlySet.has(tag))) return false;
  if (skipSet.has(step.id) || step.tags.some((tag) => skipSet.has(tag))) return false;
  return true;
}

const startedAt = new Date().toISOString();
const results = [];

console.log('KentOS AI dogrulama dizisi basliyor.');
console.log(`Repo: ${REPO_ROOT}`);
console.log(`Baslangic: ${startedAt}`);
console.log('');

for (const step of STEPS) {
  if (!shouldRun(step)) {
    results.push({ step, status: 'skipped' });
    continue;
  }

  console.log(`[${step.id}] ${step.label}`);
  console.log(`  > ${step.command} ${step.args.join(' ')}`);

  const result = await runStep(step);
  results.push({ step, ...result });

  const tag = result.status === 'passed' ? 'PASS' : result.status === 'failed' ? 'FAIL' : 'SKIP';
  console.log(`  [${tag}] exit=${result.code} duration=${result.durationMs}ms`);
  if (result.tail) {
    const tailLines = result.tail.split(/\r?\n/).slice(-10).filter(Boolean);
    for (const line of tailLines) console.log(`  | ${line.slice(0, 240)}`);
  }
  console.log('');
}

const completedAt = new Date().toISOString();
const reportLines = [];
reportLines.push('# KentOS AI Verification Report');
reportLines.push('');
reportLines.push(`Started:  ${startedAt}`);
reportLines.push(`Finished: ${completedAt}`);
reportLines.push(`Repo:     ${REPO_ROOT}`);
reportLines.push('');
reportLines.push('| step | status | code | ms | label |');
reportLines.push('|------|--------|------|----|-------|');

let anyFailed = false;
for (const result of results) {
  const status = result.status ?? 'unknown';
  if (status === 'failed' && !result.step.optional) anyFailed = true;
  reportLines.push(
    `| ${result.step.id} | ${status} | ${result.code ?? '-'} | ${result.durationMs ?? '-'} | ${result.step.label} |`,
  );
}

reportLines.push('');
reportLines.push('## Detail logs');
for (const result of results) {
  if (result.status === 'skipped') continue;
  reportLines.push('');
  reportLines.push(`### ${result.step.id} — ${result.step.label}`);
  reportLines.push(`Command: ${result.step.command} ${result.step.args.join(' ')}`);
  reportLines.push(`Status:  ${result.status}`);
  reportLines.push(`Exit:    ${result.code}`);
  reportLines.push(`Duration:${result.durationMs} ms`);
  reportLines.push('');
  reportLines.push('```');
  reportLines.push((result.output ?? '').slice(-12_000));
  reportLines.push('```');
}

await writeFile(REPORT_PATH, reportLines.join('\n'), 'utf8');

console.log(`Rapor yazildi: ${REPORT_PATH}`);
console.log(anyFailed ? 'Bazi adimlar basarisiz.' : 'Tum gerekli adimlar basarili.');
process.exit(anyFailed ? 1 : 0);

async function runStep(step) {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(step.command, step.args, {
      cwd: REPO_ROOT,
      shell: process.platform === 'win32',
      env: { ...process.env, FORCE_COLOR: '0', CI: '1' },
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', (error) => {
      output += `\n[spawn-error] ${error.message}`;
      resolve({
        status: 'failed',
        code: -1,
        durationMs: Date.now() - started,
        output,
        tail: output.slice(-1_500),
      });
    });
    child.on('close', (code) => {
      const status = code === 0 ? 'passed' : step.optional ? 'failed-optional' : 'failed';
      resolve({
        status,
        code,
        durationMs: Date.now() - started,
        output,
        tail: output.slice(-1_500),
      });
    });
  });
}
