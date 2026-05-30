/**
 * KentOS AI — tanıtım videosu için başlık kartı & alt-başlık overlay PNG üretici.
 * Playwright chromium ile 720x1280 (9:16 dikey) kartları render eder.
 * FFmpeg montaj adımı bu PNG'leri kullanır.
 *
 * Çalıştırma:  pnpm exec tsx tools/build-video-cards.ts
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = process.env.TOUR_OUT_DIR ?? 'C:\\Users\\Shadow\\Desktop\\kentos-tanitim';
const CARD_DIR = join(OUT_DIR, 'video-cards');
const LOGO = 'C:\\Users\\Shadow\\Desktop\\chatbot\\docs\\kentos-app-icon.png';

// Format: 'portrait' (720x1280, 9:16) veya 'landscape' (1280x720, 16:9)
const FORMAT = (process.env.VIDEO_FORMAT ?? 'landscape').toLowerCase();
const W = FORMAT === 'portrait' ? 720 : 1280;
const H = FORMAT === 'portrait' ? 1280 : 720;

function b64(path: string): string | null {
  if (!existsSync(path)) return null;
  return readFileSync(path).toString('base64');
}

const logo64 = b64(LOGO);
const logoImg = logo64 ? `data:image/png;base64,${logo64}` : '';

// Formata göre ölçüler (px)
const land = FORMAT !== 'portrait';
const S = {
  introLogo: land ? 130 : 170,
  introH1: land ? 86 : 92,
  introTag: land ? 28 : 30,
  outroLogo: land ? 120 : 150,
  outroH1: land ? 72 : 78,
  outroSlogan: land ? 34 : 36,
  outroSub: land ? 22 : 24,
  outroChip: land ? 19 : 20,
  bandH: land ? 230 : 340,
  contentBottom: land ? 56 : 96,
  ovH2: land ? 50 : 54,
  ovP: land ? 26 : 28,
  miniTop: land ? 40 : 54,
};

// Ortak font / reset
const baseCss = `
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{width:${W}px;height:${H}px;overflow:hidden;}
  body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;}
`;

// ── INTRO kartı ────────────────────────────────────────────────
const introHtml = `<!doctype html><html lang="tr"><head><meta charset="utf-8"/><style>${baseCss}
  .card{width:${W}px;height:${H}px;display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:linear-gradient(160deg,#0E5FD9 0%,#0a3f93 55%,#06255a 100%);color:#fff;text-align:center;padding:0 64px;}
  .logo{width:${S.introLogo}px;height:${S.introLogo}px;border-radius:34px;margin-bottom:${land ? 32 : 46}px;box-shadow:0 24px 60px rgba(0,0,0,.45);}
  h1{font-size:${S.introH1}px;letter-spacing:-3px;font-weight:700;line-height:1;}
  .tag{margin-top:${land ? 22 : 30}px;font-size:${S.introTag}px;font-weight:300;line-height:1.45;opacity:.95;}
  .rule{margin-top:${land ? 26 : 40}px;width:90px;height:5px;border-radius:3px;background:rgba(255,255,255,.65);}
</style></head><body>
  <div class="card">
    ${logoImg ? `<img class="logo" src="${logoImg}"/>` : ''}
    <h1>KentOS AI</h1>
    <div class="rule"></div>
    <p class="tag">Belediyeler için<br/>yapay zekâ destekli<br/>vatandaş yönetim platformu</p>
  </div>
</body></html>`;

// ── OUTRO kartı ────────────────────────────────────────────────
const outroHtml = `<!doctype html><html lang="tr"><head><meta charset="utf-8"/><style>${baseCss}
  .card{width:${W}px;height:${H}px;display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:linear-gradient(160deg,#06255a 0%,#0a3f93 45%,#0E5FD9 100%);color:#fff;text-align:center;padding:0 60px;}
  .logo{width:${S.outroLogo}px;height:${S.outroLogo}px;border-radius:30px;margin-bottom:${land ? 26 : 40}px;box-shadow:0 24px 60px rgba(0,0,0,.45);}
  h1{font-size:${S.outroH1}px;letter-spacing:-2px;font-weight:700;}
  .slogan{margin-top:${land ? 22 : 34}px;font-size:${S.outroSlogan}px;font-weight:600;line-height:1.4;}
  .sub{margin-top:${land ? 28 : 46}px;font-size:${S.outroSub}px;font-weight:300;opacity:.9;line-height:1.6;}
  .chips{margin-top:${land ? 26 : 40}px;display:flex;flex-wrap:wrap;gap:12px;justify-content:center;}
  .chip{border:1px solid rgba(255,255,255,.45);padding:9px 20px;border-radius:999px;font-size:${S.outroChip}px;}
</style></head><body>
  <div class="card">
    ${logoImg ? `<img class="logo" src="${logoImg}"/>` : ''}
    <h1>KentOS AI</h1>
    <p class="slogan">Daha Akıllı Şehirler,<br/>Daha Mutlu Vatandaşlar</p>
    <div class="chips">
      <span class="chip">WhatsApp</span><span class="chip">E-posta</span>
      <span class="chip">SMS</span><span class="chip">Web</span><span class="chip">IVR</span>
    </div>
    <p class="sub">Yapay zekâ ile otomatik talep yönetimi<br/>SLA takibi · KVKK uyumlu · 7/24</p>
  </div>
</body></html>`;

// ── Alt-başlık overlay'leri (saydam, video üstüne) ────────────
// Her sahne için: alt kısımda yarı saydam koyu şerit + başlık + alt metin
function lowerThird(title: string, subtitle: string): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"/><style>${baseCss}
    html,body{background:transparent;}
    .wrap{width:${W}px;height:${H}px;position:relative;}
    .band{position:absolute;left:0;right:0;bottom:0;height:${S.bandH}px;
      background:linear-gradient(to top,rgba(6,18,40,.92) 0%,rgba(6,18,40,.78) 45%,rgba(6,18,40,0) 100%);}
    .content{position:absolute;left:${land ? 60 : 48}px;right:${land ? 60 : 48}px;bottom:${S.contentBottom}px;color:#fff;max-width:${land ? 900 : 9999}px;}
    .accent{width:64px;height:6px;border-radius:3px;background:#3b9eff;margin-bottom:18px;}
    h2{font-size:${S.ovH2}px;font-weight:700;letter-spacing:-1px;line-height:1.1;
      text-shadow:0 2px 12px rgba(0,0,0,.5);}
    p{margin-top:14px;font-size:${S.ovP}px;font-weight:300;line-height:1.4;opacity:.95;
      text-shadow:0 2px 10px rgba(0,0,0,.5);}
    .logo-mini{position:absolute;top:${S.miniTop}px;left:${land ? 60 : 48}px;display:flex;align-items:center;gap:14px;}
    .logo-mini img{width:${land ? 54 : 60}px;height:${land ? 54 : 60}px;border-radius:14px;box-shadow:0 6px 18px rgba(0,0,0,.4);}
    .logo-mini span{color:#fff;font-size:${land ? 28 : 30}px;font-weight:700;letter-spacing:-.5px;
      text-shadow:0 2px 10px rgba(0,0,0,.6);}
  </style></head><body>
    <div class="wrap">
      <div class="logo-mini">${logoImg ? `<img src="${logoImg}"/>` : ''}<span>KentOS AI</span></div>
      <div class="band"></div>
      <div class="content">
        <div class="accent"></div>
        <h2>${title}</h2>
        <p>${subtitle}</p>
      </div>
    </div>
  </body></html>`;
}

const overlays = [
  { name: 'ov_1_sorun',   title: 'Şikâyetiniz mi var?',      subtitle: 'Belediyeye ulaşmak artık çok kolay' },
  { name: 'ov_2_basvuru', title: 'Tek Mesajla Başvuru',      subtitle: 'WhatsApp, web, SMS — tüm kanallar tek platformda' },
  { name: 'ov_3_ai',      title: 'Yapay Zekâ Yönlendirir',    subtitle: 'Otomatik sınıflandırma · doğru birime anında' },
  { name: 'ov_4_hizli',   title: 'Saatler İçinde Geri Dönüş', subtitle: 'Hiçbir talep kaybolmaz, her şey takip edilir' },
  { name: 'ov_5_cozum',   title: 'Çözüm Sağlandı',           subtitle: 'Hızlı, şeffaf ve takip edilebilir hizmet' },
];

async function main() {
  if (!existsSync(CARD_DIR)) mkdirSync(CARD_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

  const renderHtml = async (html: string, file: string, transparent: boolean) => {
    const htmlPath = join(CARD_DIR, file.replace('.png', '.html'));
    writeFileSync(htmlPath, html, 'utf8');
    await page.goto('file://' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    await page.screenshot({
      path: join(CARD_DIR, file),
      omitBackground: transparent,
      clip: { x: 0, y: 0, width: W, height: H },
    });
    console.log(`  ✓ ${file}`);
  };

  console.log('Kartlar üretiliyor...');
  await renderHtml(introHtml, 'intro.png', false);
  await renderHtml(outroHtml, 'outro.png', false);
  for (const o of overlays) {
    await renderHtml(lowerThird(o.title, o.subtitle), `${o.name}.png`, true);
  }

  await browser.close();
  console.log(`\n✓ Tüm kartlar hazır: ${CARD_DIR}`);
}

main().catch((e) => { console.error('KART HATASI:', e); process.exit(1); });
