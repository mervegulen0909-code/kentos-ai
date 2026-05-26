#!/usr/bin/env node
/**
 * headless-profiles.mjs
 *
 * Mevcut .browser-profiles klasorlerini Playwright ile pencere
 * acmadan (arka planda) calistirir. Oturumlar korunur.
 *
 * Kullanim:
 *   node scripts/headless-profiles.mjs --browser chrome
 *   node scripts/headless-profiles.mjs --browser brave --slots 4,5,6
 *   node scripts/headless-profiles.mjs --browser all
 *   node scripts/headless-profiles.mjs --browser all --truly-headless
 *   node scripts/headless-profiles.mjs --browser chrome --profile ChatGPT-01 --visible
 *   node scripts/headless-profiles.mjs --browser chrome --profile ChatGPT-01 --visible --url https://chatgpt.com
 *
 * --truly-headless  : Gercek headless mod (ChatGPT/Gemini bazi sayfalarda
 *                     algilayabilir; varsayilan degil)
 * --visible         : Tarayici penceresini kullaniciya gosterir.
 * --profile         : Slot/prefix yerine dogrudan profil klasoru sec.
 * --url             : Varsayilan proje URL'i yerine belirli bir URL ac.
 * Varsayilan mod    : Pencere gorunmez ama tam ekran gibi calisir (off-screen).
 *                     Oturum koruma ve site uyumu icin daha guvenli.
 */

import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot   = path.join(__dirname, '..');
const profilesRoot = path.join(repoRoot, '.browser-profiles');

// --- Tarayici konfigurasyonu ---
// ProfilePrefix: open-browser-profile.ps1 ile ayni klasor isimlendirmesi
const BROWSER_CONFIG = {
  chrome: {
    label: 'Chrome / Etsy',
    executableCandidates: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ],
    profilePrefix: 'Etsy',
    url: 'https://www.etsy.com',
  },
  brave: {
    label: 'Brave / YouTube',
    executableCandidates: [
      'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    ],
    profilePrefix: 'YouTube',
    url: 'https://www.youtube.com',
  },
  edge: {
    label: 'Edge / Sosyal',
    channel: 'msedge',
    executableCandidates: [
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ],
    profilePrefix: 'Social',
    url: 'https://www.facebook.com',
  },
};

// --- Arg parse ---
const argv = process.argv.slice(2);
const get  = (flag) => { const i = argv.indexOf(flag); return i !== -1 ? argv[i + 1] : null; };
const has  = (flag) => argv.includes(flag);

if (has('--help') || has('-h')) {
  console.log(`headless-profiles

Usage:
  node scripts/headless-profiles.mjs --browser chrome
  node scripts/headless-profiles.mjs --browser brave --slots 4,5,6
  node scripts/headless-profiles.mjs --browser all --truly-headless
  node scripts/headless-profiles.mjs --browser chrome --profile ChatGPT-01 --visible
  node scripts/headless-profiles.mjs --browser chrome --profile ChatGPT-01 --visible --url https://chatgpt.com
`);
  process.exit(0);
}

const browserArg   = get('--browser') ?? 'all';
const slotsArg     = get('--slots');
const profileArg   = get('--profile');
const urlArg       = get('--url');
const trulyHeadless = has('--truly-headless');
const visible      = has('--visible');
const slots        = slotsArg
  ? slotsArg.split(',').map(n => parseInt(n.trim(), 10)).filter(Boolean)
  : [1, 2, 3, 4, 5, 6];

const targetBrowsers = browserArg === 'all'
  ? ['chrome', 'brave', 'edge']
  : [browserArg];

// --- Executable bul ---
function resolveExe(cfg) {
  if (cfg.channel) return null; // msedge channel; Playwright halleder
  for (const p of cfg.executableCandidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// --- Ana mantik ---
const contexts = [];
let launched = 0;
let failed   = 0;

const modeLabel = trulyHeadless ? 'truly-headless' : visible ? 'visible' : 'off-screen (onerilen)';
console.log(`\n[headless-profiles] Mod: ${modeLabel}`);
console.log(`[headless-profiles] Tarayicilar: ${targetBrowsers.join(', ')} | Slotlar: ${slots.join(',')}\n`);

for (const browser of targetBrowsers) {
  const cfg = BROWSER_CONFIG[browser];
  const exePath = resolveExe(cfg);

  const profileNames = profileArg
    ? [profileArg]
    : slots.map((slot) => `${cfg.profilePrefix}-${String(slot).padStart(2, '0')}`);

  for (const profileName of profileNames) {
    const userDataDir = path.join(profilesRoot, browser, profileName);

    // Profil klasoru yoksa olustur
    fs.mkdirSync(userDataDir, { recursive: true });

    /** @type {import('@playwright/test').LaunchOptions & { userDataDir?: string }} */
    const launchOpts = {
      headless: trulyHeadless,
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-popup-blocking',
        // Off-screen: pencere acilir ama ekranda gorunmez
        ...(!trulyHeadless && !visible ? ['--window-position=-32000,-32000', '--window-size=1920,1080'] : []),
        ...(visible ? ['--window-size=1600,1000'] : []),
      ],
    };

    if (exePath)       launchOpts.executablePath = exePath;
    if (cfg.channel)   launchOpts.channel        = cfg.channel;

    try {
      const ctx = await chromium.launchPersistentContext(userDataDir, launchOpts);
      const page = ctx.pages()[0] ?? await ctx.newPage();
      const targetUrl = urlArg ?? cfg.url;
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      console.log(`  ✓  ${cfg.label.padEnd(20)} ${profileName}  →  ${cfg.url}`);
      contexts.push({ ctx, label: `${cfg.label}/${profileName}` });
      launched++;
    } catch (err) {
      console.error(`  ✗  ${cfg.label} / ${profileName}: ${err.message}`);
      failed++;
    }
  }
}

console.log(`\n[headless-profiles] ${launched} profil aktif${failed ? `, ${failed} basarisiz` : ''}.`);
console.log('[headless-profiles] Cikis icin Ctrl+C\n');

// Cikista tum context'leri kapat
async function shutdown() {
  console.log('\n[headless-profiles] Kapatiliyor...');
  await Promise.allSettled(contexts.map(({ ctx }) => ctx.close()));
  process.exit(0);
}
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

// Surekli calissin
await new Promise(() => {});
