# Playwright-Lite Smoke Plan

Bu doküman, ağır binary ve tam E2E yatırımı yapmadan önce en küçük otomasyon dilimini tanımlar.

## Amaç

Manuel browser smoke yükünü azaltmak için üç kritik happy-path akışı otomatikleştirmek:

1. Admin login smoke
2. Citizen report submit + TK redirect smoke
3. Citizen track TK-only smoke

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

## Durum sözleşmesi

- `passed`: üç senaryo da yeşil
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

Bu dalga yalnız plan seviyesidir. Playwright bağımlılığı, browser binary indirmesi ve gerçek test dosyası ekleme adımı açık kullanıcı onayı olmadan başlatılmamalıdır.