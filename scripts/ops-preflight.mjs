#!/usr/bin/env node
// KentOS AI production-readiness preflight.
// This script never deploys, sends live messages, or deletes data. It checks
// the guardrails and writes a local report under output/ops-preflight/.

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const withVerification = args.has('--with-verification');
const allowLive = args.has('--allow-live');
const allowRetentionDelete = args.has('--allow-retention-delete');
const allowDeploy = args.has('--allow-deploy');
const json = args.has('--json');

const startedAt = new Date();
const reportDir = path.join(REPO_ROOT, 'output', 'ops-preflight');
const reportPath = path.join(reportDir, `ops-preflight-${stamp(startedAt)}.md`);

const checks = [];
const commandResults = [];

await addGitChecks();
addEnvGuardChecks();
addProductionReadinessChecks();

if (withVerification) {
  await runVerificationCommands();
} else {
  addCheck({
    id: 'verification-skipped',
    status: 'warning',
    summary: 'Static verification commands were not run.',
    detail: 'Run with --with-verification to execute db:generate, api/worker/shared tests, typecheck, build, and diff hygiene.',
  });
}

const summary = summarize(checks);
await mkdir(reportDir, { recursive: true });
await writeFile(reportPath, renderMarkdown(summary), 'utf8');

if (json) {
  console.log(JSON.stringify({ summary, checks, commandResults, reportPath }, null, 2));
} else {
  printHuman(summary);
}

process.exit(summary.blocked > 0 || summary.failed > 0 ? 1 : 0);

async function addGitChecks() {
  const status = await run('git', ['status', '--short', '--branch']);
  const aheadBehind = await run('git', ['rev-list', '--left-right', '--count', 'origin/master...master']);

  if (status.code !== 0) {
    addCheck({ id: 'git-status', status: 'blocked', summary: 'Git status could not be read.', detail: status.output });
    return;
  }

  const statusLines = status.output.trim().split(/\r?\n/).filter(Boolean);
  const dirtyLines = statusLines.filter((line) => !line.startsWith('## '));
  addCheck({
    id: 'git-clean',
    status: dirtyLines.length ? 'blocked' : 'passed',
    summary: dirtyLines.length ? 'Working tree is dirty.' : 'Working tree is clean.',
    detail: dirtyLines.length ? dirtyLines.join('\n') : status.output.trim(),
  });

  if (aheadBehind.code !== 0) {
    addCheck({ id: 'git-sync', status: 'blocked', summary: 'Ahead/behind count could not be read.', detail: aheadBehind.output });
    return;
  }

  const [behind, ahead] = aheadBehind.output.trim().split(/\s+/).map((value) => Number.parseInt(value, 10));
  addCheck({
    id: 'git-sync',
    status: behind === 0 && ahead === 0 ? 'passed' : 'blocked',
    summary: behind === 0 && ahead === 0 ? 'master is synced with origin/master.' : `master is not synced. behind=${behind} ahead=${ahead}`,
    detail: `origin/master...master = ${behind} ${ahead}`,
  });
}

function addEnvGuardChecks() {
  const liveFlags = [
    'WHATSAPP_OUTBOUND_LIVE',
    'INSTAGRAM_OUTBOUND_LIVE',
    'FACEBOOK_OUTBOUND_LIVE',
    'SMS_OUTBOUND_LIVE',
    'EMAIL_OUTBOUND_LIVE',
  ].filter((name) => process.env[name] === 'true');

  addCheck({
    id: 'live-outbound',
    status: liveFlags.length && !allowLive ? 'blocked' : 'passed',
    summary: liveFlags.length
      ? `Live outbound flags are enabled: ${liveFlags.join(', ')}`
      : 'No live outbound flags are enabled.',
    detail: liveFlags.length && !allowLive
      ? 'Pass --allow-live only after explicit operator approval and provider readiness evidence.'
      : 'Live outbound approval gate is satisfied for this preflight mode.',
  });

  const retentionDryRun = process.env.RETENTION_DRY_RUN ?? 'true';
  const deleteObjects = process.env.RETENTION_DELETE_ATTACHMENT_OBJECTS === 'true';
  const retentionDeleteRequested = retentionDryRun === 'false' || deleteObjects;
  addCheck({
    id: 'retention-delete-guard',
    status: retentionDeleteRequested && !allowRetentionDelete ? 'blocked' : 'passed',
    summary: retentionDeleteRequested
      ? `Retention delete mode requested. RETENTION_DRY_RUN=${retentionDryRun}, RETENTION_DELETE_ATTACHMENT_OBJECTS=${process.env.RETENTION_DELETE_ATTACHMENT_OBJECTS ?? 'unset'}`
      : 'Retention is in safe dry-run mode.',
    detail: retentionDeleteRequested && !allowRetentionDelete
      ? 'Pass --allow-retention-delete only after explicit data-cleanup approval. This script still does not delete data.'
      : 'Retention delete approval gate is satisfied for this preflight mode.',
  });

  const deployRequested = process.env.PRODUCTION_DEPLOY === 'true' || process.env.DEPLOY_PRODUCTION === 'true';
  addCheck({
    id: 'deploy-guard',
    status: deployRequested && !allowDeploy ? 'blocked' : 'passed',
    summary: deployRequested ? 'Production deploy flag is enabled.' : 'No production deploy flag is enabled.',
    detail: deployRequested && !allowDeploy
      ? 'Pass --allow-deploy only after explicit production deploy approval. This script still does not deploy.'
      : 'Deploy approval gate is satisfied for this preflight mode.',
  });
}

function addProductionReadinessChecks() {
  const requiredForProduction = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'S3_BUCKET',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY',
    'INTERNAL_API_KEY',
    'WIDGET_ORIGIN_ALLOWLIST',
  ];
  const missing = requiredForProduction.filter((name) => !process.env[name]);
  addCheck({
    id: 'prod-env-present',
    status: missing.length ? 'warning' : 'passed',
    summary: missing.length ? `Production env values are missing: ${missing.join(', ')}` : 'Required production env values are present.',
    detail: 'Secrets are not printed. This check only verifies presence.',
  });

  const scanningProvider = process.env.ATTACHMENT_SCAN_PROVIDER;
  addCheck({
    id: 'attachment-scan-provider',
    status: scanningProvider ? 'passed' : 'warning',
    summary: scanningProvider ? `Attachment scan provider configured: ${scanningProvider}` : 'Attachment virus scanning provider is not configured.',
    detail: 'Current product state allows this as a documented placeholder, independent from retention.',
  });
}

async function runVerificationCommands() {
  const steps = [
    ['db-generate', 'pnpm', ['db:generate'], { PRISMA_GENERATE_NO_ENGINE: process.env.PRISMA_GENERATE_NO_ENGINE ?? 'true' }],
    ['api-test', 'pnpm', ['--filter', '@kentos/api', 'test']],
    ['worker-test', 'pnpm', ['--filter', '@kentos/worker', 'test']],
    ['shared-test', 'pnpm', ['--filter', '@kentos/shared', 'test']],
    ['typecheck', 'pnpm', ['typecheck']],
    ['build', 'pnpm', ['build']],
    ['diff-check', 'git', ['diff', '--check']],
  ];

  for (const [id, command, commandArgs, env] of steps) {
    const result = await run(command, commandArgs, env);
    commandResults.push({ id, command: `${command} ${commandArgs.join(' ')}`, ...result });
    addCheck({
      id,
      status: result.code === 0 ? 'passed' : 'failed',
      summary: result.code === 0 ? `${id} passed.` : `${id} failed.`,
      detail: result.output.slice(-4_000),
    });
  }
}

function addCheck(check) {
  checks.push({ ...check, detail: check.detail ?? '' });
}

function summarize(items) {
  const counts = { passed: 0, warning: 0, blocked: 0, failed: 0 };
  for (const item of items) counts[item.status] += 1;
  return {
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    reportPath,
    ...counts,
    status: counts.blocked || counts.failed ? 'blocked' : counts.warning ? 'warning' : 'passed',
  };
}

function printHuman(summary) {
  console.log(`KentOS ops preflight: ${summary.status}`);
  console.log(`passed=${summary.passed} warning=${summary.warning} blocked=${summary.blocked} failed=${summary.failed}`);
  console.log(`report=${summary.reportPath}`);
  for (const check of checks) {
    const marker = check.status === 'passed' ? 'PASS' : check.status === 'warning' ? 'WARN' : check.status === 'failed' ? 'FAIL' : 'BLOCK';
    console.log(`[${marker}] ${check.id}: ${check.summary}`);
  }
}

function renderMarkdown(summary) {
  const lines = [
    '# KentOS Ops Preflight Report',
    '',
    `Started: ${summary.startedAt}`,
    `Finished: ${summary.completedAt}`,
    `Status: ${summary.status}`,
    '',
    '| check | status | summary |',
    '|---|---|---|',
  ];

  for (const check of checks) {
    lines.push(`| ${check.id} | ${check.status} | ${escapeTable(check.summary)} |`);
  }

  lines.push('', '## Details');
  for (const check of checks) {
    lines.push('', `### ${check.id}`, '', `Status: ${check.status}`, '', check.detail || 'No detail.');
  }

  if (commandResults.length) {
    lines.push('', '## Command Results');
    for (const result of commandResults) {
      lines.push('', `### ${result.id}`, '', `Command: ${result.command}`, `Exit: ${result.code}`, '', '```');
      lines.push(result.output.slice(-12_000));
      lines.push('```');
    }
  }

  return `${lines.join('\n')}\n`;
}

async function run(command, commandArgs, extraEnv = {}) {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(resolveCommand(command), commandArgs, {
      cwd: REPO_ROOT,
      env: { ...process.env, ...extraEnv, FORCE_COLOR: '0', CI: '1' },
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', (error) => {
      resolve({ code: -1, durationMs: Date.now() - started, output: `${output}\n${error.message}` });
    });
    child.on('close', (code) => {
      resolve({ code, durationMs: Date.now() - started, output });
    });
  });
}

function resolveCommand(command) {
  if (process.platform !== 'win32') return command;
  if (command === 'pnpm') return 'pnpm.cmd';
  return command;
}

function stamp(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function escapeTable(value) {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
