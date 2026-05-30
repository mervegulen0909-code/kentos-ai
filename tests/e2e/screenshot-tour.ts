/**
 * KentOS AI — uçtan uca screenshot turu.
 * Gerçek kullanıcı gibi citizen-web + admin-web + API'yi gezer, her çalışan
 * ekranın tam-sayfa PNG'ini alır, console/network hatalarını loglar ve
 * PDF tanıtım dosyası için bir manifest.json üretir.
 *
 * Çalıştırma (QA stack ayakta olmalı — pnpm qa:local:start):
 *   E2E_ADMIN_BASE_URL=http://127.0.0.1:3111 \
 *   E2E_CITIZEN_BASE_URL=http://127.0.0.1:3112 \
 *   E2E_API_BASE_URL=http://127.0.0.1:3110/api/v1 \
 *   pnpm exec tsx tests/e2e/screenshot-tour.ts
 */
import { chromium, type Browser, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN = process.env.E2E_ADMIN_BASE_URL ?? 'http://127.0.0.1:3111';
const CITIZEN = process.env.E2E_CITIZEN_BASE_URL ?? 'http://127.0.0.1:3112';
const API = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:3110/api/v1';
const TENANT = 'demo-belediye';

const OUT_DIR = process.env.TOUR_OUT_DIR ?? 'C:\\Users\\Shadow\\Desktop\\kentos-tanitim';
const SHOT_DIR = join(OUT_DIR, 'screenshots');

type Section = 'citizen' | 'admin' | 'api';
interface Frame {
  id: string;
  section: Section;
  title: string;
  desc: string;
  file: string;
  ok: boolean;
  note?: string;
}

const frames: Frame[] = [];
const issues: string[] = [];

function logIssue(where: string, msg: string) {
  const line = `[${where}] ${msg}`;
  issues.push(line);
  console.log('  ⚠ ' + line);
}

/** Sayfaya console/network hata dinleyicisi tak. */
function watch(page: Page, where: string) {
  page.on('console', (m) => {
    if (m.type() === 'error') logIssue(where, `console.error: ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => logIssue(where, `pageerror: ${e.message.slice(0, 200)}`));
  page.on('response', (r) => {
    if (r.status() >= 500) logIssue(where, `HTTP ${r.status()} ${r.url().slice(0, 160)}`);
  });
}

async function snap(page: Page, f: Omit<Frame, 'file' | 'ok'>, opts: { settle?: number } = {}) {
  const file = `${f.section}_${f.id}.png`;
  const where = `${f.section}/${f.id}`;
  try {
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    if (opts.settle) await page.waitForTimeout(opts.settle);
    await page.screenshot({ path: join(SHOT_DIR, file), fullPage: true });
    frames.push({ ...f, file, ok: true });
    console.log(`  ✓ ${where} → ${file}`);
  } catch (err) {
    frames.push({ ...f, file, ok: false, note: String(err).slice(0, 160) });
    logIssue(where, `screenshot başarısız: ${String(err).slice(0, 160)}`);
  }
}

async function go(page: Page, url: string, where: string) {
  watch(page, where);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  } catch (err) {
    logIssue(where, `navigate başarısız: ${String(err).slice(0, 160)}`);
  }
}

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true });
  console.log(`Çıktı: ${SHOT_DIR}`);
  console.log(`Hedefler: citizen=${CITIZEN} admin=${ADMIN} api=${API}\n`);

  const browser: Browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: 'tr-TR',
  });
  const page = await ctx.newPage();

  // ---------------- CITIZEN: public + tenant ----------------
  console.log('— Vatandaş portalı —');
  await go(page, `${CITIZEN}/`, 'citizen/landing');
  await snap(page, { section: 'citizen', id: '01_landing', title: 'Vatandaş Portalı — Karşılama', desc: '7/24 yapay zekâ destekli başvuru asistanı; örnek talepler, güvenli takip ve SLA izleme vurgusu ile açılış ekranı.' });

  await go(page, `${CITIZEN}/${TENANT}/report`, 'citizen/report');
  await snap(page, { section: 'citizen', id: '02_report_form', title: 'Başvuru Formu', desc: 'Vatandaş; açıklama, adres, iletişim ve fotoğraf/belge ekleyerek belediyeye talep iletir. "Anlatın → Kayda alın → Takip edin" akışı.' });

  // Gerçek kullanıcı akışı: formu doldur + gönder → ticket sayfası
  let trackingToken = '';
  try {
    const stamp = Date.now().toString().slice(-6);
    await page.getByLabel('Açıklama').fill(`Tanıtım turu ${stamp}: Atatürk Mahallesi 12. Sokak'ta kaldırım taşları yerinden çıkmış, yayalar geçemiyor.`);
    await page.fill('#addressText', 'Atatürk Mahallesi, 12. Sokak, belediye binası karşısı');
    await page.fill('#displayName', 'Ayşe Yılmaz');
    await page.fill('#phone', '+905551112233');
    await page.fill('#email', 'ayse.yilmaz@example.com');
    await Promise.all([
      page.waitForURL(/\/ticket\/TK-/, { timeout: 45_000 }),
      page.getByRole('button', { name: 'Başvuruyu oluştur' }).click(),
    ]);
    const m = page.url().match(/\/ticket\/(TK-[A-F0-9]{16})/);
    if (m) trackingToken = m[1];
    await snap(page, { section: 'citizen', id: '03_report_success', title: 'Başvuru Oluşturuldu — Takip Ekranı', desc: 'Başvuru kayda alınır ve vatandaşa özel gizli takip kodu (TK-…) ile durum, birim, kategori ve çözüm süresi gösterilir.' }, { settle: 500 });
  } catch (err) {
    logIssue('citizen/report-submit', `akış başarısız: ${String(err).slice(0, 200)}`);
  }

  await go(page, `${CITIZEN}/${TENANT}/track`, 'citizen/track');
  await snap(page, { section: 'citizen', id: '04_track', title: 'Başvuru Takibi', desc: 'Vatandaş, kendisine verilen gizli takip koduyla başvurusunun güncel durumunu sorgular.' });

  // Takip kodunu gir → sonuç sayfası (canlı veri)
  if (trackingToken) {
    try {
      const input = page.locator('input[name="trackingToken"], input[type="text"]').first();
      await input.fill(trackingToken);
      await Promise.all([
        page.waitForURL(/\/ticket\/TK-/, { timeout: 30_000 }),
        page.getByRole('button').filter({ hasText: /Sorgula|Takip|Ara/i }).first().click().catch(() => page.keyboard.press('Enter')),
      ]).catch(() => {});
      await snap(page, { section: 'citizen', id: '05_ticket_detail', title: 'Başvuru Detayı & Zaman Çizelgesi', desc: 'Başvurunun durumu, ilgili birim, öncelik ve vatandaşa açık güncellemelerin zaman çizelgesi tek ekranda.' }, { settle: 400 });
    } catch (err) {
      logIssue('citizen/ticket-detail', String(err).slice(0, 160));
    }
  }

  await go(page, `${CITIZEN}/${TENANT}/appointments`, 'citizen/appointments');
  await snap(page, { section: 'citizen', id: '06_appointments', title: 'Randevu Oluşturma', desc: 'Vatandaş, uygun zaman dilimlerinden birini seçerek belediye birimiyle randevu alır.' });

  await go(page, `${CITIZEN}/${TENANT}/faq`, 'citizen/faq');
  await snap(page, { section: 'citizen', id: '07_faq', title: 'Sık Sorulan Sorular', desc: 'Çok dilli (Türkçe/İngilizce/Kürtçe/Arapça) bilgi bankası; vatandaş kendi diline göre makaleleri görüntüler.' });

  await go(page, `${CITIZEN}/${TENANT}/account`, 'citizen/account');
  await snap(page, { section: 'citizen', id: '08_account', title: 'Hesap & KVKK Veri Silme', desc: 'Giriş yapan vatandaş kişisel bilgilerini görür ve KVKK kapsamında veri silme (anonimleştirme) hakkını kullanabilir.' });

  await go(page, `${CITIZEN}/${TENANT}/login`, 'citizen/login');
  await snap(page, { section: 'citizen', id: '09_login', title: 'Vatandaş Girişi', desc: 'Google veya telefon ile güvenli giriş; giriş sonrası başvuru formu otomatik doldurulur.' });

  await go(page, `${CITIZEN}/widget/${TENANT}`, 'citizen/widget');
  await snap(page, { section: 'citizen', id: '10_widget', title: 'Gömülebilir Sohbet Widget’ı', desc: 'Belediye web sitesine tek satır script ile eklenen, yapay zekâ destekli sohbet penceresi.' });

  await go(page, `${CITIZEN}/privacy-policy`, 'citizen/privacy');
  await snap(page, { section: 'citizen', id: '11_privacy', title: 'Gizlilik Politikası', desc: 'Toplanan veriler, amaç, saklama süresi ve vatandaş hakları şeffaf biçimde açıklanır.' });

  await go(page, `${CITIZEN}/data-deletion`, 'citizen/data-deletion');
  await snap(page, { section: 'citizen', id: '12_data_deletion', title: 'Veri Silme Talebi', desc: 'KVKK/GDPR uyumlu veri silme yönergeleri ve self-servis seçenekleri.' });

  // ---------------- MASKOT AI: yüzen asistan + soru-cevap + ticket ----------------
  console.log('\n— Maskot AI asistan —');
  await go(page, `${CITIZEN}/${TENANT}/report`, 'citizen/maskot');
  await snap(page, { section: 'citizen', id: '13_maskot_launcher', title: 'AI Maskot — Yüzen Sohbet Asistanı', desc: 'Her belediye sayfasında yüzen, tek tıkla açılan yapay zekâ sohbet butonu. Bilgi Bankası ve hazır yanıtlarla beslenir; kullandıkça gelişir.' }, { settle: 1000 });

  try {
    // Sağ alttaki yüzen maskot butonuna tıkla
    const mascotBtn = page.locator('button').filter({ hasText: /yardımcı|asistan/i }).last();
    const altBtn = page.locator('[data-testid="mascot-trigger"], .mascot-trigger, [aria-label*="asistan"]').first();
    const btn = (await mascotBtn.count()) ? mascotBtn : altBtn;
    await btn.click({ timeout: 8_000 });
    await page.waitForTimeout(1500);
    await snap(page, { section: 'citizen', id: '14_maskot_open', title: 'AI Maskot — Sohbet Açık & Karşılama', desc: 'Maskot açıldığında vatandaşı belediye tonu ve diliyle karşılar. Çok turlu konuşma yönetir; eksik bilgiyi soru sorarak tamamlar.' }, { settle: 400 });

    // Bilgi bankası soru-cevap
    const chatInput = page.locator('textarea, input[placeholder*="sorunuzu"], input[placeholder*="yazın"], input[placeholder*="çöp"]').last();
    await chatInput.fill('Çöp toplama saatleri nedir?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(10_000);
    await snap(page, { section: 'citizen', id: '15_maskot_qa', title: 'AI Maskot — Anlık Soru Yanıtlama (Bilgi Bankası)', desc: 'AI, soruyu Bilgi Bankası makalelerinden grounded yanıtla karşılar. Bilmediğinde uydurmaz, doğru birime yönlendirir. Sistem her yeni makaleyle zenginleşir.' }, { settle: 400 });

    // Net şikâyet → otomatik ticket + TK kodu
    await chatInput.fill('Park girişindeki aydınlatma direği devrilmiş, tehlike oluşturuyor.');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(14_000);
    await snap(page, { section: 'citizen', id: '16_maskot_ticket', title: 'AI Maskot — Otomatik Ticket & TK Kodu', desc: 'Net şikâyeti AI anında tanır; iletişim bilgisi olmadan ticket oluşturur, vatandaşa güvenli TK takip kodunu verir. Konuşma tarihçesi ticket\'a eklenir.' }, { settle: 600 });
  } catch (err) {
    logIssue('citizen/maskot-flow', `maskot akış başarısız: ${String(err).slice(0, 200)}`);
  }

  // ---------------- ADMIN: login + tüm sayfalar ----------------
  console.log('\n— Yönetim paneli —');
  await go(page, `${ADMIN}/login`, 'admin/login');
  await snap(page, { section: 'admin', id: '01_login', title: 'Yönetici Girişi', desc: 'Belediye kodu, e-posta ve şifre ile güvenli yönetici girişi.' });

  let adminOk = false;
  try {
    await page.getByLabel('Belediye kodu').fill(TENANT);
    await page.getByLabel('E-posta').fill('admin@demo.local');
    await page.getByLabel('Sifre').fill('ChangeMe123!');
    await Promise.all([
      page.waitForURL(`${ADMIN}/`, { timeout: 30_000 }),
      page.getByRole('button', { name: 'Guvenli giris yap' }).click(),
    ]);
    adminOk = true;
  } catch (err) {
    logIssue('admin/login', `giriş başarısız: ${String(err).slice(0, 200)}`);
  }

  if (adminOk) {
    const adminPages: Array<{ id: string; path: string; title: string; desc: string; click?: boolean }> = [
      { id: '02_dashboard', path: '/', title: 'Yönetim Paneli — Genel Bakış', desc: 'Açık kuyruk yükü, SLA aşımı/yaklaşan, bugün sonuçlanan ve memnuniyet skoru gibi KPI kartları + öncelik kuyruğu.' },
      { id: '03_tickets', path: '/tickets', title: 'Talep Kuyruğu', desc: 'Tüm başvurular; durum, birim, kategori ve atanan kullanıcıya göre filtrelenebilir liste.' },
      { id: '05_reports', path: '/reports', title: 'Operasyon Raporları', desc: 'SLA uyumu, AI kullanım/maliyet, kanal performansı, CSAT ve operatör performansı tek ekranda.' },
      { id: '06_queues', path: '/queues', title: 'Birim Kuyrukları', desc: 'Departman bazında iş yükü, yaklaşan ve aşılan SLA görünümü.' },
      { id: '07_handoffs', path: '/handoffs', title: 'Operatör Devri Kuyruğu', desc: 'Yapay zekânın insana aktardığı canlı görüşmeler; kanal ve niyet bilgisiyle.' },
      { id: '08_users', path: '/users', title: 'Kullanıcı & Personel Yönetimi', desc: 'Rol bazlı (yönetici, operatör, departman personeli, salt-okuma) ekip yönetimi.' },
      { id: '09_citizens', path: '/citizens', title: 'Vatandaş Kayıtları (KVKK)', desc: 'Vatandaş dizini ve KVKK kapsamında anonimleştirme işlemleri.' },
      { id: '10_settings', path: '/settings', title: 'Ayarlar — Widget, SLA, Saklama, AI Bütçe', desc: 'Web asistanı kurulumu, KVKK saklama süreleri, AI bütçe kontrolü, birim/kategori/SLA/şablon yönetimi.' },
      { id: '11_faq', path: '/faq', title: 'FAQ Yönetimi', desc: 'Çok dilli bilgi bankası makalelerinin oluşturulması ve yayınlanması.' },
      { id: '12_channels', path: '/channels', title: 'Kanal Entegrasyonları', desc: 'Slack/Teams webhook, Postmark e-posta ve Telegram bot entegrasyonları.' },
      { id: '13_appointments', path: '/appointments', title: 'Randevu Yönetimi', desc: 'Vatandaş randevu taleplerinin yönetildiği ekran.' },
      { id: '14_canned_replies', path: '/canned-replies', title: 'Hazır Yanıtlar', desc: 'Sık kullanılan yanıt şablonları.' },
      { id: '15_ticket_tags', path: '/ticket-tags', title: 'Talep Etiketleri', desc: 'Başvuru sınıflandırması için etiket yönetimi.' },
      { id: '16_social_monitor', path: '/social-monitor', title: 'Sosyal Medya İzleme', desc: 'Sosyal kanallardan gelen talep/şikâyet izleme.' },
      { id: '17_ivr', path: '/ivr', title: 'IVR / Sesli Yanıt', desc: 'Telefon/sesli asistan yönlendirme yapılandırması.' },
    ];

    for (const p of adminPages) {
      await go(page, `${ADMIN}${p.path}`, `admin/${p.id}`);
      await snap(page, { section: 'admin', id: p.id, title: p.title, desc: p.desc }, { settle: 300 });
    }

    // Ticket detay — ilk satıra tıkla
    try {
      await go(page, `${ADMIN}/tickets`, 'admin/ticket-detail-nav');
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      const row = page.locator('a[href*="/tickets/"]').first();
      if (await row.count()) {
        await Promise.all([page.waitForLoadState('domcontentloaded'), row.click()]);
        await snap(page, { section: 'admin', id: '04_ticket_detail', title: 'Talep Detayı & Operasyonlar', desc: 'Durum güncelleme, birime/kişiye atama, AI intake özeti, iç not, vatandaş mesajı ve audit zaman çizelgesi.' }, { settle: 500 });
      } else {
        logIssue('admin/ticket-detail', 'tıklanacak ticket satırı bulunamadı');
      }
    } catch (err) {
      logIssue('admin/ticket-detail', String(err).slice(0, 160));
    }
  }

  // ---------------- API ----------------
  console.log('\n— API —');
  for (const [id, path, title, desc] of [
    ['01_health', '/health', 'API — Sağlık Durumu', 'NestJS API sağlık ucu: veritabanı, Redis ve depolama servislerinin durumu.'],
    ['02_docs', '/docs', 'API — Swagger Dokümantasyonu', 'OpenAPI/Swagger arayüzü ile tüm uç noktaların interaktif dokümantasyonu.'],
  ] as const) {
    // health: /api/v1/health  |  swagger: /api/docs (global prefix dışında)
    const base = API.replace(/\/api\/v1$/, '');
    const url = id === '01_health' ? `${API}${path}` : `${base}/api/docs`;
    await go(page, url, `api/${id}`);
    const body = await page.content().catch(() => '');
    if (id === '02_docs' && !/swagger|openapi|redoc/i.test(body)) {
      logIssue('api/docs', `Swagger bulunamadı (${url}) — atlanıyor`);
      continue;
    }
    await snap(page, { section: 'api', id, title, desc }, { settle: 300 });
  }

  await browser.close();

  // Manifest + issues yaz
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify({ tenant: TENANT, generatedFrom: { ADMIN, CITIZEN, API }, frames }, null, 2), 'utf8');
  writeFileSync(join(OUT_DIR, 'tour-issues.log'), issues.length ? issues.join('\n') + '\n' : '(hata yok)\n', 'utf8');

  const okCount = frames.filter((f) => f.ok).length;
  console.log(`\n=== TUR BİTTİ ===`);
  console.log(`Görsel: ${okCount}/${frames.length} başarılı`);
  console.log(`Sorun: ${issues.length}`);
  console.log(`Manifest: ${join(OUT_DIR, 'manifest.json')}`);
  if (issues.length) {
    console.log('\nSorunlar:');
    issues.forEach((i) => console.log('  - ' + i));
  }
}

main().catch((e) => {
  console.error('TUR HATASI:', e);
  process.exit(1);
});
