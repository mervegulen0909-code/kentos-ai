/**
 * KentOS AI — tanıtım PDF üretici.
 * screenshot-tour.ts'in ürettiği manifest.json + PNG'lerden kapaklı, bölümlü
 * bir HTML tanıtım dokümanı kurar ve Playwright chromium ile A4 PDF'e render eder.
 *
 * Çalıştırma:  pnpm exec tsx tools/build-promo-pdf.ts
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = process.env.TOUR_OUT_DIR ?? 'C:\\Users\\Shadow\\Desktop\\kentos-tanitim';
const SHOT_DIR = join(OUT_DIR, 'screenshots');
const LOGO = 'C:\\Users\\Shadow\\Desktop\\chatbot\\docs\\kentos-app-icon.png';
const PDF_OUT = join(OUT_DIR, 'KentOS-AI-Tanitim.pdf');

interface Frame { id: string; section: 'citizen' | 'admin' | 'api'; title: string; desc: string; file: string; ok: boolean; }
interface Manifest { tenant: string; frames: Frame[]; }

const SECTIONS: Record<Frame['section'], { title: string; tag: string; blurb: string }> = {
  citizen: { title: 'Vatandaş Portalı & AI Maskot', tag: 'citizen-web', blurb: 'Vatandaşların 7/24 başvuru oluşturduğu, takip ettiği ve AI Maskot sohbet asistanıyla doğrudan iletişim kurduğu yapay zekâ destekli portal. Maskot; Bilgi Bankası\'ndan öğrenir, net şikâyette ticket oluşturur, TK kodu verir.' },
  admin: { title: 'Yönetim Paneli', tag: 'admin-web', blurb: 'Belediye ekiplerinin başvuruları yönettiği, SLA ve performansı izlediği, AI içgörüleriyle sistemi yapılandırdığı yönetim arayüzü.' },
  api: { title: 'Platform & API', tag: 'NestJS API', blurb: 'Çok kiracılı, güvenli ve ölçeklenebilir backend; sağlık izleme ve OpenAPI dokümantasyonu.' },
};

function b64(path: string): string | null {
  if (!existsSync(path)) return null;
  return readFileSync(path).toString('base64');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function main() {
  const manifest: Manifest = JSON.parse(readFileSync(join(OUT_DIR, 'manifest.json'), 'utf8'));
  const frames = manifest.frames.filter((f) => f.ok);
  const logo64 = b64(LOGO);

  const order: Frame['section'][] = ['citizen', 'admin', 'api'];
  let body = '';

  // Kapak
  body += `
  <section class="cover">
    ${logo64 ? `<img class="logo" src="data:image/png;base64,${logo64}" alt="KentOS AI"/>` : ''}
    <h1>KentOS AI</h1>
    <p class="tagline">Türk belediyeleri için yapay zekâ destekli<br/>çok-kanallı vatandaş yönetim platformu</p>
    <div class="cover-meta">
      <span>Ürün Tanıtımı</span>
      <span>Demo: ${esc(manifest.tenant)}</span>
    </div>
    <div class="cover-stats">
      <div><strong>${frames.length}</strong><span>ekran</span></div>
      <div><strong>3</strong><span>uygulama</span></div>
      <div><strong>7/24</strong><span>otomasyon</span></div>
    </div>
  </section>`;

  // ── YAPAY ZEKA BÖLÜMÜ ──────────────────────────────────────────
  body += `
  <section class="divider ai-divider">
    <span class="chip ai-chip">Yapay Zekâ</span>
    <h2>KentOS AI'ın Yapay Zekâ Motoru</h2>
    <p>Her başvuru uçtan uca yapay zekâyla işlenir — konuşan maskot asistandan otomatik sınıflandırmaya, öğrenen bilgi tabanından maliyet kontrolüne kadar. Sistem kullandıkça, içerik eklendikçe daha akıllı hâle gelir.</p>
  </section>

  <section class="page feat-page">
    <div class="caption">
      <span class="chip small ai-chip">Yapay Zekâ Özellikleri</span>
      <h3>Öğrenen, Konuşan, Otomasyon Sağlayan 12 AI Özelliği</h3>
      <p>KentOS AI her vatandaş talebini otomatik işler, maskot asistanı sohbetle yönlendirir, Bilgi Bankası\'ndan öğrenerek gelişir; operatör yükünü azaltır, SLA'yı güvence altına alır.</p>
    </div>
    <div class="feat-grid">
      <div class="feat-card ai-card">
        <div class="feat-icon">🤖</div>
        <h4>Otomatik Talep Sınıflandırma</h4>
        <p>Gelen her başvuruyu AI anında kategori, departman ve önceliğe göre sınıflandırır. Güven skoru (0–1) her sınıflandırmayla birlikte kaydedilir.</p>
      </div>
      <div class="feat-card ai-card">
        <div class="feat-icon">💬</div>
        <h4>AI Yanıt Önerisi</h4>
        <p>Operatöre talep içeriğine ve geçmiş yanıtlara göre hazır yanıt önerilir. Tek tıkla düzenlenip gönderilebilir.</p>
      </div>
      <div class="feat-card ai-card">
        <div class="feat-icon">🔍</div>
        <h4>Semantik Tekrar Tespiti</h4>
        <p>Yeni başvurular, vektör gömme (embedding) tabanlı semantik arama ile mevcut talepler arasında aranır; aynı sorun birden fazla kaydedilmez.</p>
      </div>
      <div class="feat-card ai-card">
        <div class="feat-icon">🔄</div>
        <h4>AI → İnsan Devri (Handoff)</h4>
        <p>AI çözemediği konuları otomatik olarak operatör kuyruğuna aktarır. Kanal, niyet ve bağlam bilgisiyle birlikte iletilir.</p>
      </div>
      <div class="feat-card ai-card">
        <div class="feat-icon">💰</div>
        <h4>Kiracı Başına AI Bütçe Kontrolü</h4>
        <p>Günlük AI harcaması kiracı bazında sınırlandırılır. Bütçe aşıldığında AI otomatik duraklar, admin uyarı alır.</p>
      </div>
      <div class="feat-card ai-card">
        <div class="feat-icon">📊</div>
        <h4>AI Kullanım & Maliyet Takibi</h4>
        <p>Her AI çalıştırması (model, token, maliyet, gecikme, başarı/hata) AiRun tablosuna kaydedilir. Raporlar anlık izlenebilir.</p>
      </div>
      <div class="feat-card ai-card">
        <div class="feat-icon">📝</div>
        <h4>AI Talep Özeti (Intake Özeti)</h4>
        <p>Vatandaşın ilettiği bilgilerden (niyet, adres, iletişim, konum sinyali) otomatik yapılandırılmış özet çıkarılır.</p>
      </div>
      <div class="feat-card ai-card">
        <div class="feat-icon">🌐</div>
        <h4>Çok Kanallı AI Asistanı</h4>
        <p>WhatsApp, web widget, SMS, Instagram, Facebook ve Telegram kanallarında vatandaşla AI aracılığıyla diyalog kurulur.</p>
      </div>
      <div class="feat-card ai-card">
        <div class="feat-icon">🔒</div>
        <h4>KVKK Uyumlu AI İşleme</h4>
        <p>TC kimlik numaraları ve kişisel veriler AI'a gönderilmeden önce maskelenir. Tüm AI işlemleri denetim kütüğüne kaydedilir.</p>
      </div>
      <div class="feat-card ai-card">
        <div class="feat-icon">🪄</div>
        <h4>AI Maskot — Yüzen Sohbet Asistanı</h4>
        <p>Vatandaş portalının her sayfasında yüzen, tek tıkla açılan AI sohbet penceresi. Net şikâyeti anında ticket'a çevirir, güvenli TK takip kodu verir; iletişim bilgisi olmayan vatandaş bile başvurabilir.</p>
      </div>
      <div class="feat-card ai-card">
        <div class="feat-icon">🧠</div>
        <h4>Öğrenen Yapay Zeka</h4>
        <p>Bilgi Bankası makaleleri ve operatör onaylı hazır yanıtlar AI'ın bilgi tabanını besler. Her yeni makale maskot ve AI yanıtlarını zenginleştirir; sistem kullandıkça, içerik eklendikçe gelişir — sıfır ek geliştirme maliyetiyle.</p>
      </div>
      <div class="feat-card ai-card">
        <div class="feat-icon">💡</div>
        <h4>Çok Turlu Bağlam Yönetimi</h4>
        <p>Maskot birden fazla mesajı bağlamıyla birlikte hatırlar; eksik bilgiyi (adres, iletişim) soru sorarak tamamlar, vatandaşı adım adım yönlendirir. Her konuşma oturumu ticket tarihçesine otomatik eklenir.</p>
      </div>
    </div>
  </section>

  <!-- ── TÜM PLATFORM ÖZELLİKLERİ ──────────────────────────────── -->
  <section class="divider feat-divider">
    <span class="chip">Platform</span>
    <h2>Tüm Platform Özellikleri</h2>
    <p>KentOS AI, belediyenin ihtiyaç duyduğu her şeyi tek çatı altında sunar.</p>
  </section>

  <section class="page feat-page">
    <div class="caption">
      <span class="chip small">Platform Özellikleri</span>
      <h3>Kurumsal Düzeyde, Genişletilebilir Altyapı</h3>
      <p>Tek bir belediyeden büyük şehir ağlarına kadar ölçeklenen, güvenli ve uyumlu platform.</p>
    </div>
    <div class="feat-grid">
      <div class="feat-card">
        <div class="feat-icon">🏛️</div>
        <h4>Çok Kiracılı Mimari</h4>
        <p>Her belediye tamamen izole kiracı olarak çalışır. Veri, yapılandırma ve AI bütçesi ayrıdır. Süper-admin tek konsoldan tüm kiracıları yönetir.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon">📡</div>
        <h4>10+ Kanal Entegrasyonu</h4>
        <p>WhatsApp Business, E-posta (Postmark), SMS, Instagram DM, Facebook Messenger, Telegram, Twitter/X, web widget, mobil uygulama ve telefon IVR.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon">⏱️</div>
        <h4>SLA Politika Motoru</h4>
        <p>Departman, kategori ve önceliğe göre yanıt/çözüm süreleri tanımlanır. İhlal öncesi uyarı ve gerçek zamanlı SLA aşımı bildirimi.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon">📋</div>
        <h4>Talep Yaşam Döngüsü Yönetimi</h4>
        <p>YENİ → TRİYAJ → ATANDI → İŞLEMDE → BİLGİ BEKLENİYOR → ÇÖZÜLDÜ → KAPANDI akışı; her adım denetim kütüğüne yazılır.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon">🔔</div>
        <h4>Gerçek Zamanlı Bildirimler</h4>
        <p>SSE (Server-Sent Events) ile anlık talep güncellemeleri. Slack/Teams webhook, e-posta digest ve FCM mobil push desteği.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon">📁</div>
        <h4>Güvenli Dosya Yönetimi</h4>
        <p>S3 uyumlu depolama (MinIO/AWS), ClamAV virüs taraması, imzalı URL ile güvenli indirme. Her dosyanın tarama durumu izlenir.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon">🛡️</div>
        <h4>KVKK & Güvenlik Uyumluluğu</h4>
        <p>TC kimlik maskeleme, gönüllü KVKK onay kaydı, vatandaş veri silme (anonimleştirme) hakkı, IP izin listesi ve 2FA/TOTP desteği.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon">📈</div>
        <h4>Analitik & Raporlama</h4>
        <p>Kanal performansı, departman yükü, CSAT skoru, AI kullanım/maliyet, operatör verimliliği ve SLA uyum oranı raporları.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon">🗓️</div>
        <h4>Randevu Sistemi</h4>
        <p>Vatandaş uygun zaman dilimini seçerek online randevu alır. Belediye tarafında randevu yönetimi ve slot konfigürasyonu.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon">📚</div>
        <h4>Çok Dilli Bilgi Bankası</h4>
        <p>Türkçe, İngilizce, Kürtçe ve Arapça FAQ makaleleri. Vatandaş dilini seçer; yönetici içerikleri yayınlar.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon">🔗</div>
        <h4>Gömülebilir Widget</h4>
        <p>Tek satır script ile belediye web sitesine entegre edilen AI sohbet penceresi. CORS kısıtlaması ve özel stil desteği.</p>
      </div>
      <div class="feat-card">
        <div class="feat-icon">⚙️</div>
        <h4>Asenkron İş Kuyruğu</h4>
        <p>BullMQ ile 9 farklı kuyruk: SLA denetimi, medya işleme, dış kanal teslimati, webhook, CSAT, veri saklama ve özet e-postalar.</p>
      </div>
    </div>
  </section>`;

  // Bölümler
  for (const sec of order) {
    const secFrames = frames.filter((f) => f.section === sec);
    if (!secFrames.length) continue;
    const meta = SECTIONS[sec];
    body += `
    <section class="divider">
      <span class="chip">${esc(meta.tag)}</span>
      <h2>${esc(meta.title)}</h2>
      <p>${esc(meta.blurb)}</p>
    </section>`;
    for (const f of secFrames) {
      const img = b64(join(SHOT_DIR, f.file));
      if (!img) continue;
      body += `
      <section class="page">
        <div class="caption">
          <span class="chip small">${esc(meta.title)}</span>
          <h3>${esc(f.title)}</h3>
          <p>${esc(f.desc)}</p>
        </div>
        <div class="shot"><img src="data:image/png;base64,${img}" alt="${esc(f.title)}"/></div>
      </section>`;
    }
  }

  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"/>
  <style>
    :root{ --brand:#0E5FD9; --ink:#0f172a; --muted:#475569; --bg:#f8fafc; --line:#e2e8f0; }
    *{ box-sizing:border-box; margin:0; padding:0; }
    body{ font-family:'Segoe UI',system-ui,-apple-system,sans-serif; color:var(--ink); }
    section{ page-break-after:always; padding:48px 56px; }
    /* Kapak */
    .cover{ height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;
      background:linear-gradient(160deg,#0E5FD9 0%,#0a3f93 60%,#06255a 100%); color:#fff; }
    .cover .logo{ width:120px; height:120px; border-radius:28px; margin-bottom:28px; box-shadow:0 20px 50px rgba(0,0,0,.35); }
    .cover h1{ font-size:64px; letter-spacing:-2px; }
    .cover .tagline{ font-size:22px; opacity:.92; margin-top:16px; line-height:1.5; font-weight:300; }
    .cover-meta{ margin-top:34px; display:flex; gap:14px; }
    .cover-meta span{ border:1px solid rgba(255,255,255,.4); padding:8px 18px; border-radius:999px; font-size:14px; }
    .cover-stats{ margin-top:54px; display:flex; gap:48px; }
    .cover-stats div{ display:flex; flex-direction:column; }
    .cover-stats strong{ font-size:40px; font-weight:700; }
    .cover-stats span{ font-size:14px; opacity:.8; text-transform:uppercase; letter-spacing:1px; }
    /* Bölüm ayracı */
    .divider{ height:100vh; display:flex; flex-direction:column; justify-content:center; background:var(--bg); border-left:14px solid var(--brand); }
    .divider .chip{ align-self:flex-start; }
    .divider h2{ font-size:48px; letter-spacing:-1px; margin:16px 0 14px; }
    .divider p{ font-size:20px; color:var(--muted); max-width:640px; line-height:1.6; font-weight:300; }
    /* İçerik sayfası */
    .page{ display:flex; flex-direction:column; min-height:100vh; }
    .caption{ border-bottom:1px solid var(--line); padding-bottom:18px; margin-bottom:22px; }
    .caption h3{ font-size:28px; letter-spacing:-.5px; margin:10px 0 8px; }
    .caption p{ font-size:15px; color:var(--muted); line-height:1.6; max-width:760px; }
    .shot{ flex:1; display:flex; align-items:flex-start; justify-content:center; }
    .shot img{ max-width:100%; max-height:78vh; border:1px solid var(--line); border-radius:12px;
      box-shadow:0 18px 44px rgba(15,23,42,.14); object-fit:contain; }
    .chip{ display:inline-block; background:rgba(14,95,217,.1); color:var(--brand); font-weight:600;
      font-size:12px; padding:6px 14px; border-radius:999px; text-transform:uppercase; letter-spacing:.6px; }
    .chip.small{ font-size:11px; padding:4px 10px; }
    /* AI bölümü */
    .ai-divider{ background:linear-gradient(135deg,#0a1628 0%,#0E5FD9 100%); color:#fff; border-left:none; }
    .ai-divider h2{ color:#fff; }
    .ai-divider p{ color:rgba(255,255,255,.85); }
    .ai-chip{ background:rgba(255,255,255,.2); color:#fff; }
    /* Özellik grid */
    .feat-page{ padding-top:36px; }
    .feat-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-top:18px; }
    .feat-card{ background:#fff; border:1px solid var(--line); border-radius:12px; padding:18px 16px;
      box-shadow:0 2px 8px rgba(15,23,42,.06); }
    .feat-card h4{ font-size:13px; font-weight:700; margin:8px 0 6px; color:var(--ink); }
    .feat-card p{ font-size:12px; color:var(--muted); line-height:1.55; }
    .feat-icon{ font-size:26px; line-height:1; }
    .ai-card{ border-left:3px solid var(--brand); background:linear-gradient(135deg,#f0f6ff 0%,#fff 100%); }
  </style></head><body>${body}</body></html>`;

  const htmlPath = join(OUT_DIR, 'promo.html');
  writeFileSync(htmlPath, html, 'utf8');

  return chromium.launch().then(async (browser) => {
    const page = await browser.newPage();
    await page.goto('file://' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    await page.pdf({ path: PDF_OUT, format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
    await browser.close();
    console.log(`✓ PDF üretildi: ${PDF_OUT}`);
    console.log(`  ${frames.length} ekran, ${order.filter((s) => frames.some((f) => f.section === s)).length} bölüm`);
  });
}

main().catch((e) => { console.error('PDF HATASI:', e); process.exit(1); });
