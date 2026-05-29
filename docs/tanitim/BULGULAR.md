# KentOS AI — Canlı Uçtan Uca Manuel Kontrol Bulguları

> Tarih: 2026-05-29 · Ortam: canlı (`izmirusulü.com` / `xn--izmirusul-y9a.com`) · Yöntem: tarayıcıyla manuel gezinti + konsol/DOM denetimi.

## 🔴 Kritik bulgu — site geneli hydration ölümü (DÜZELTİLDİ, deploy bekliyor)

**Belirti:** Vatandaş portalında maskot açılmıyordu. Derinlemesine bakınca **tüm citizen-web (ve admin-web) sayfaları hydrate olmuyordu** — `window.__next_f` undefined, hiçbir buton/input/maskot React'e bağlı değil → tüm client etkileşimi ölü.

**Kök neden:** `infra/Caddyfile.prod` CSP'sinde `script-src 'self' 'strict-dynamic' 'unsafe-inline'`. Next.js nonce üretmediği için `'strict-dynamic'` nonce/hash'siz **tüm script'leri** (inline bootstrap + chunk'lar) bloke ediyordu. Server-action form POST + sayfa navigasyonu çalıştığı için hata **maskelenmişti** (muhtemelen uzun süredir mevcuttu — CSP'de eski `api.anthropic.com` referansı vardı).

**Düzeltme (nonce tabanlı, güvenli — `'strict-dynamic'` korundu):**
- `apps/admin-web/middleware.ts` + `apps/citizen-web/middleware.ts`: her istekte nonce üretip CSP'yi request+response header'ına yazar; Next nonce'u script'lere basar.
- `infra/Caddyfile.prod`: CSP Caddy'den kaldırıldı (app middleware sahibi); stale anthropic referansı temizlendi.
- `.github/workflows/ci.yml`: deploy'da `--force-recreate caddy` (volume-mount config yeniden okunsun) + `db:seed`.
- **Yerelde kanıtlandı:** tek istekte CSP-header nonce == script nonce, eşleşiyor, `__next_f` mevcut.
- **Durum:** `chore/ci-auto-db-seed` branch'inde commit'li; **merge + deploy gerekiyor.**

## Bölüm durum tablosu

| Alan | Bölüm | Render (SSR) | Not |
|---|---|---|---|
| Vatandaş | Başvuru (`/report`) | ✅ | Form + harita + konum seçici + **maskot launcher** görünür |
| Vatandaş | Takip (`/track`) | ✅ | Takip kodu sorgu formu |
| Vatandaş | SSS (`/faq`) | ✅ render | **Boş** (veri eksiği) → pending `db:seed` 12 makale yükler |
| Vatandaş | E-Randevu (`/appointments`) | ✅ render | **Slot yok** (veri eksiği) → öneri: admin'den slot ekle / seed'e ekle |
| Vatandaş | Hesap (`/account`) | ✅ | Giriş guard'ı doğru çalışıyor |
| Vatandaş | **Maskot (AI sohbet)** | ✅ arka uç | Backend canlıda **OpenAI gpt-4o ile çalışıyor** (curl ile kanıtlandı). UI açılması CSP deploy'unu bekliyor |
| Admin | Login | ✅ | Server-action, CSP'den bağımsız çalışıyor |
| Admin | Dashboard | ✅ | KPI kartları (açık kuyruk 4, SLA aşımı 3) |
| Admin | Talepler (liste) | ✅ | 4 gerçek başvuru, filtreler |
| Admin | Talep detayı | ✅ | **AI intake özeti** (niyet/öncelik/güven), durum, atama, denetim |
| Admin | Raporlar | ✅ | Operasyon KPI + AI kullanım & maliyet (provider artık `openai`) |
| Admin | Vatandaşlar | ✅ | KVKK anonimleştirme + export |
| Admin | Ayarlar | ✅ | **Tek satır widget kurulum kodu**, KVKK retention, AI bütçe, departman/kategori/SLA |
| Admin | Operatör devri / Birim kuyrukları / Kullanıcılar / Hazır Yanıtlar / Etiketler / Bilgi Bankası / Kanallar / Sosyal / IVR | ✅ render | SSR sağlam; sayfalar hatasız açılıyor |

## Düzeltilen kod hataları (bu çalışmada)
1. **CSP hydration** (yukarıda) — `chore/ci-auto-db-seed`.
2. **ai-usage testi** çelişkiliydi (sağlayıcı birleştirme) — düzeltildi (master'da, PR #17).
3. **Maskot ticket koşulu** widget e2e'yi kırıyordu — geri alındı (master'da).

## Veri eksikleri (kod değil — içerik)
- **SSS boş** → pending `db:seed` (12 makale) merge edilince dolar.
- **Randevu slotu yok** → demo için admin → Randevular'dan slot ekle veya seed'e `AppointmentSlot` ekle (öneri).
- Ticket sayısı az (4) → maskot/başvuru akışıyla artırılabilir (zengin demo için).

## Deploy gereken her şey (tek merge)
`chore/ci-auto-db-seed` merge edilince CI deploy: nonce CSP (hydration düzelir → maskot + tüm client etkileşim çalışır) + Caddy reload + `db:seed` (SSS/hazır yanıt dolar).
👉 https://github.com/mervegulen0909-code/kentos-ai/compare/master...chore/ci-auto-db-seed?expand=1
