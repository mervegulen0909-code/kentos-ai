# Playwright-Lite Smoke Plan

Bu doküman, ağır binary ve tam E2E yatırımı yapmadan önce en küçük otomasyon dilimini tanımlar.

## Amaç

Manuel browser smoke yükünü azaltmak için üç kritik happy-path akışı otomatikleştirmek:

1. Admin login smoke
2. Citizen report submit + TK redirect smoke
3. Citizen track TK-only smoke
4. Widget preview smoke

## Kapsam dışı (bu dalgada)

- Tam görsel regresyon
- Tüm role-matrix uçlarının E2E kapsanması
- External entegrasyonlar (WhatsApp/email/send)

## Ön koşullar

- Local Docker infra çalışır durumda
- DB generate/migrate/seed tamam
- API 3110, admin 3111, citizen 3112 ayakta
- `pnpm smoke:api` yeşil

## Önerilen minimum senaryolar

### Senaryo 1 — Admin login

- `http://127.0.0.1:3111/login`
- Seeded admin ile giriş
- Dashboard redirect doğrulama
- Raw error görünmediği doğrulama

### Senaryo 2 — Citizen report + TK redirect

- `http://127.0.0.1:3112/demo-belediye/report`
- Form submit
- `ticket/[trackingToken]` redirect doğrulama
- Token regex: `TK-[A-F0-9]{16}`

### Senaryo 3 — Citizen track TK-only

- `http://127.0.0.1:3112/demo-belediye/track`
- Geçerli TK ile başarı
- Legacy `KNT-*` ile invalid/not-found

### Senaryo 4 — Widget preview + embed shell

- `http://127.0.0.1:3112/widget/demo-belediye`
- Widget composer görünür
- Mesaj submit güvenli başarı/follow-up state döndürür
- Raw API hata metni veya internal alan görünmez

## Durum sözleşmesi

- `passed`: dört senaryo da yeşil
- `partial`: en az bir senaryo eksik/atlanmış
- `blocked`: environment blocker
- `not_run`: bu dalgada çalıştırılmadı

## Kanıt formatı

Her koşuda şu alanlar zorunlu:

- Tarih
- Owner
- Komut
- Sonuç
- Gap/Blocker (varsa)
- SLA (partial/blocked ise)

## Uygulama notu

Bu dalga artık plan seviyesinden uygulama seviyesine taşındı. Minimum kurulum şu sözleşmeyle korunur:

- Tek browser hedefi: Chromium
- İlk CI kapsamı: admin login, citizen report/track ve widget preview kritik senaryolari
- Job adı: `ui-e2e`
- Fail davranışı: herhangi bir senaryo kırmızıysa PR kararı kırmızı
- Kanıt kaydı: owner / tarih / komut / sonuç / blocker-SLA alanları PR ve run-log içinde zorunlu

## CI entegrasyonu

- Workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
- Komut: `pnpm e2e`
- Browser install: `pnpm e2e:install`
- Beklenen PR sinyali: `CI / ui-e2e`

## Seed varsayımları

- Tenant: `demo-belediye`
- Admin user: `admin@demo.local`
- Admin password: `ChangeMe123!`
- Citizen public flow canlı API üstünden gerçek ticket üretir; fixture ile statik sahte token kullanılmaz.