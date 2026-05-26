#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_NOTES_PATH = path.join(REPO_ROOT, '.accounts.local.md');
const DOCS_DIR = path.join(REPO_ROOT, 'docs', 'accounts');
const MACHINE_ENV_PATH = path.join(REPO_ROOT, '.accounts.machine.env');

const DEFAULT_REPOS = ['apps/admin-web', 'apps/api', 'apps/citizen-web'];
const DEFAULT_DISTRIBUTION = [
  {
    id: 'account-01',
    platform: 'ChatGPT',
    purpose: 'Genel gelistirme',
    primaryRepo: 0,
    backupRepo: 1,
  },
  {
    id: 'account-02',
    platform: 'ChatGPT',
    purpose: 'Frontend ve UI',
    primaryRepo: 2,
    backupRepo: 0,
  },
  {
    id: 'account-03',
    platform: 'ChatGPT',
    purpose: 'Backend ve test',
    primaryRepo: 1,
    backupRepo: 2,
  },
  {
    id: 'account-04',
    platform: 'Gemini',
    purpose: 'Ikinci gorus ve alternatif cozum',
    primaryRepo: 0,
    backupRepo: 2,
  },
  {
    id: 'account-05',
    platform: 'Gemini',
    purpose: 'Arastirma ve yedek kullanim',
    primaryRepo: 1,
    backupRepo: 0,
  },
  {
    id: 'account-06',
    platform: 'Gemini',
    purpose: 'Ek yedek ve alternatif akış',
    primaryRepo: 2,
    backupRepo: 1,
  },
];

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`setup-ai-accounts

Usage:
  node scripts/setup-ai-accounts.mjs
  node scripts/setup-ai-accounts.mjs --repos repo-1,repo-2,repo-3 --manager Bitwarden --overwrite
`);
  process.exit(0);
}

const options = parseArgs(process.argv.slice(2));
const repos = options.repos.length ? options.repos : DEFAULT_REPOS;
const manager = options.manager || 'Bitwarden';
const overwrite = options.overwrite;

await mkdir(DOCS_DIR, { recursive: true });

if (!overwrite && existsSync(LOCAL_NOTES_PATH)) {
  console.error(`Mevcut dosya bulundu: ${LOCAL_NOTES_PATH}`);
  console.error('Uzerine yazmak icin `--overwrite` kullanin.');
  process.exit(1);
}

await writeFile(LOCAL_NOTES_PATH, buildLocalNotes({ repos, manager }), 'utf8');
await writeFile(MACHINE_ENV_PATH, buildMachineEnv({ repos }), 'utf8');

console.log('AI hesap kurulumu tamamlandi.');
console.log(`Yerel dosya: ${LOCAL_NOTES_PATH}`);
console.log(`Makine env dosyasi: ${MACHINE_ENV_PATH}`);
console.log(`Repo alanlari: ${repos.join(', ')}`);
console.log('Sonraki adim: .accounts.local.md ve .accounts.machine.env icindeki alanlari doldurun.');

function parseArgs(argv) {
  const parsed = {
    repos: [],
    manager: '',
    overwrite: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--repos') {
      const value = argv[index + 1] ?? '';
      parsed.repos = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }

    if (arg === '--manager') {
      parsed.manager = (argv[index + 1] ?? '').trim();
      index += 1;
      continue;
    }

    if (arg === '--overwrite') {
      parsed.overwrite = true;
    }
  }

  return parsed;
}

function buildLocalNotes({ repos, manager }) {
  const repoRows = repos
    .map((repo, index) => `| repo-${index + 1} | ${repo} | Ana kullanim alani |`)
    .join('\n');

  const accountSections = DEFAULT_DISTRIBUTION.map((account) => {
    const primaryRepo = repos[account.primaryRepo] ?? repos[0] ?? 'repo-1';
    const backupRepo = repos[account.backupRepo] ?? repos[0] ?? 'repo-1';
    const browserProfile = `Chrome - ${account.platform} ${account.id.slice(-2)}`;
    const managerKey = `${manager} / ${account.platform}-${account.id}`;

    return [
      `## ${account.id}`,
      `- Platform: ${account.platform}`,
      `- Amac: ${account.purpose}`,
      `- Ana alan: ${primaryRepo}`,
      `- Yedek alan: ${backupRepo}`,
      '- Maskeli e-posta: ',
      `- Sifre yoneticisi kaydi: ${managerKey}`,
      `- Browser profile: ${browserProfile}`,
      '- Not: ',
      '',
    ].join('\n');
  }).join('\n');

  return [
    '# Local AI Accounts',
    '',
    'Bu dosya yereldir ve `.gitignore` ile korunur.',
    'Gercek sifreyi duz metin olarak yazmayin. Sadece maskeleme, etiket ve yonetim notu tutun.',
    '',
    '## Repo Alanlari',
    '',
    '| Etiket | Yol | Not |',
    '| --- | --- | --- |',
    repoRows,
    '',
    '## Hesaplar',
    '',
    accountSections,
  ].join('\n');
}

function buildMachineEnv({ repos }) {
  const repoVars = repos
    .map((repo, index) => `REPO_${index + 1}_PATH=${repo}`)
    .join('\n');

  const accountVars = DEFAULT_DISTRIBUTION.map((account) => {
    const key = normalizeEnvKey(`${account.platform}_${account.id}`);
    return [
      `${key}_EMAIL=`,
      `${key}_PASSWORD=`,
      `${key}_LABEL=${account.id}`,
      `${key}_PRIMARY_SCOPE=${repos[account.primaryRepo] ?? repos[0] ?? 'repo-1'}`,
      `${key}_BACKUP_SCOPE=${repos[account.backupRepo] ?? repos[0] ?? 'repo-1'}`,
    ].join('\n');
  }).join('\n\n');

  return [
    '# Local machine-only account placeholders',
    '# Bu dosya ornektir. Gercek degerleri kendi yerel gizli dosyaniza tasiyin.',
    '',
    repoVars,
    '',
    accountVars,
    '',
  ].join('\n');
}

function normalizeEnvKey(value) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}
