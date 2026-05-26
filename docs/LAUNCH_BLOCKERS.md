# KentOS AI - Launch Blockers & Post-Deploy Checklist

> Son guncelleme: 2026-05-26
> Branch: `codex/launch-train-2026-05-22` | PR #9 (Draft)

---

## Tamamlananlar

| # | Gorev | Tarih |
|---|---|---|
| 1 | Hetzner SSH key erisimi (ed25519) kuruldu | 2026-05-22 |
| 2 | Production stack saglik kontrolu (api + gateway healthy) | 2026-05-22 |
| 3 | GitHub Draft PR #9 olusturuldu | 2026-05-22 |
| 4 | Postmark uretim onay talebi gonderildi | 2026-05-22 |
| 5 | cebtecep.com DKIM TXT kaydi eklendi (Natro DNS) | 2026-05-22 |
| 6 | cebtecep.com Return-Path CNAME kaydi eklendi (Natro DNS) | 2026-05-22 |
| 7 | Postmark Return-Path dogrulandi (Verified) | 2026-05-22 |
| 8 | Firebase Auth entegrasyonu tamamlandi (Google + Phone login) | 2026-05-23 |
| 9 | Firebase service account key olusturuldu -> `apps/api/.env.local` yazildi | 2026-05-23 |
| 10 | Firebase Auth yetkili alan: `cebtecep.com` eklendi | 2026-05-23 |
| 11 | Meta Business Verification onaylandi | 2026-05-22 |
| 12 | Meta Access Verification gonderildi (`In review`) | 2026-05-26 |
| 13 | Meta App Secret alindi -> `apps/whatsapp-gateway/.env.local` olusturuldu | 2026-05-26 |
| 14 | WhatsApp test Phone Number ID alindi: `1108414422357698` | 2026-05-26 |
| 15 | System User `Kentos Api` olusturuldu + KentOS AI ve WhatsApp hesabi atandi | 2026-05-25 |
| 16 | Permanent Token alindi -> `apps/whatsapp-gateway/.env.local` yazildi | 2026-05-25 |
| 17 | App icon asset'i repoya eklendi: `docs/kentos-app-icon.png` | 2026-05-25 |
| 18 | Public privacy policy sayfasi eklendi: `/privacy-policy` | 2026-05-26 |
| 19 | Meta App domains `cebtecep.com` kaydedildi | 2026-05-26 |
| 20 | Meta Category `Community & government` onaylandi | 2026-05-26 |
| 21 | Meta Terms of Service URL kaydedildi | 2026-05-26 |
| 22 | KVKK erasure hardening + smoke test commit push (`813c74a`) | 2026-05-26 |
| 23 | Typecheck temiz (api, citizen-web, worker) | 2026-05-26 |
| 24 | DKIM DNS kaydi dogrulandi (nslookup OK, Postmark propagasyon bekliyor) | 2026-05-26 |
| 25 | Meta Basic Settings tamamlandi (icon, privacy, ToS, category, app domains) | 2026-05-26 |

---

## Otomatik Bekleyenler

| # | Gorev | Durum | Not |
|---|---|---|---|
| 1 | Postmark DKIM dogrulamasi | DNS dogru, resolver gecikmesi olabilir | Otomatik dogrulanir |
| 2 | Postmark hesap onayi (test mode -> production) | `We're reviewing your account` | Postmark ekibi inceliyor |

---

## Insan Gerektiren Blokerler

### 1. WhatsApp production numarasi

- Meta Access Verification su an `In review`.
- Onay geldikten sonra gercek numara eklenecek ve `META_PHONE_NUMBER_ID` production degeriyle guncellenecek.
- Test numarasi `+1 555-647-0488` (ID: `1108414422357698`) gecici olarak yeterli.

### 2. Meta User Data Deletion URL (manuel girilmeli)

- Meta Basic Settings diger alanlari tamamlandi (icon, privacy, ToS, category, app domains).
- **Sadece** `User data deletion` URL alani Meta'nin React formu nedeniyle otomasyonla girilemedi (native setter + React onChange + form_input hepsi denendi).
- Elle girilmesi gereken deger: `https://cebtecep.com/data-deletion/`
- Meta URL: [App Settings Basic](https://developers.facebook.com/apps/1473102857894676/settings/basic/)
- **DKIM DNS kaydi Google DNS (8.8.8.8) uzerinden dogru donuyor, Postmark resolver'i henuz guncellenmemis.**

### 3. Postmark production onayi

- Domain kayitlari hazir (DKIM DNS doğru, propagasyon bekleniyor).
- Hesap halen review asamasinda; production outbound icin Postmark tarafinin onayi bekleniyor.

---

## Repo Tarafinda Kapanan Launch Dilimleri

### KVKK / retention

- Public citizen erasure endpoint'i mevcut.
- Citizen web hesap akisi erasure sonrasinda tenant-path cookie temizligini korur.
- Retention processor production'da `RETENTION_DRY_RUN=true` ise operatoru uyaran bir log yazar.

### Citizen web app-review assets

- Privacy policy route: `/privacy-policy`
- Metadata category: `government`
- Public icon route: `/icon`
- Manifest icon kaydi: `1024x1024 png`

---

## Merge Oncesi Repo Checklist

- [ ] Calisma agacindaki ilgili degisiklikler dogrulanmis olmali
- [ ] Typecheck en az touched workspace icin gecmeli
- [ ] App Review alanlari Meta panelinde manuel doldurulmali
- [ ] Access Verification sonucu beklenmeli

---

## Post-Merge Ops Adimlari

1. `ssh root@46.224.217.16`
2. `cd /opt/kentos-ai && git pull origin master`
3. `pnpm install --frozen-lockfile`
4. `npx prisma migrate deploy`
5. `docker compose -f infra/docker-compose.prod.yml up -d --build`
6. `bash infra/healthcheck-prod.sh`
7. `curl -I https://cebtecep.com`

---

## Sunucu Erisim Bilgileri

- IP: `46.224.217.16`
- Kullanici: `root`
- SSH Key: `~/.ssh/hetzner_rescue` (ed25519)
- Baglanti: `ssh -i ~/.ssh/hetzner_rescue root@46.224.217.16`

---

## Postmark DNS Kontrol

- URL: [Postmark Signature Domain](https://account.postmarkapp.com/signature_domains/5570049)
- DKIM Hostname: `20260519190009pm._domainkey.cebtecep.com`
- Return-Path: `pm-bounces.cebtecep.com` -> `pm.mtasv.net`
