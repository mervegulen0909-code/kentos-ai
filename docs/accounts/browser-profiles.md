# Browser Profiles

Bu duzen, her hesap icin ayri tarayici profili kullanir.
Ilk girisi bir kez yaparsin, sonra ayni komutla hesap acik gelir.

## Tarayici - Proje Atamasi

| Tarayici | Proje | Profil Klasoru |
| --- | --- | --- |
| Chrome | Etsy | `.browser-profiles/chrome/` |
| Brave | YouTube | `.browser-profiles/brave/` |
| Edge | Sosyal Medya | `.browser-profiles/edge/` |

## Profil Yapisi (Her Tarayicida 6 Profil)

| Slot | Profil Adi | Platform | Hesap |
| --- | --- | --- | --- |
| 1 | ChatGPT-01 | ChatGPT | account-01 / arf***@gmail.com |
| 2 | ChatGPT-02 | ChatGPT | account-02 / fil***@gmail.com |
| 3 | ChatGPT-03 | ChatGPT | account-03 / tre***@gmail.com |
| 4 | Gemini-04 | Gemini | account-04 / bor***@gmail.com |
| 5 | Gemini-05 | Gemini Ultra | account-05 / fil***@gmail.com |
| 6 | Gemini-06 | Gemini | account-06 / th3***@gmail.com |

Toplam: 3 tarayici x 6 profil = 18 ayri oturum.

## Tum 18 Profil Ayni Anda Acik Olmak Zorunda Degil

Sadece ilgili projenin 6 profilini ac. Diger gruplar kapali kalabilir.

## Grup Acma Komutlari (Onerilir)

Etsy projesi - Chrome 6 profil:

```powershell
pnpm open:etsy
# veya
powershell -ExecutionPolicy Bypass -File .\scripts\open-etsy-6.ps1
```

YouTube projesi - Brave 6 profil:

```powershell
pnpm open:youtube
# veya
powershell -ExecutionPolicy Bypass -File .\scripts\open-youtube-6.ps1
```

Sosyal Medya projesi - Edge 6 profil:

```powershell
pnpm open:social
# veya
powershell -ExecutionPolicy Bypass -File .\scripts\open-social-6.ps1
```

Tum 18 profil:

```powershell
pnpm open:all
# veya
powershell -ExecutionPolicy Bypass -File .\scripts\open-all-18.ps1
```

Headless / arka plan acilisi:

```powershell
pnpm headless:etsy
pnpm headless:youtube
pnpm headless:social
pnpm headless:all
```

## Tekil Profil Acma Komutlari

Sadece belirli bir slot acmak gerekirse:

```powershell
# Chrome - Etsy slot 3
powershell -ExecutionPolicy Bypass -File .\scripts\open-etsy-chrome.ps1 -Slot 3

# Brave - YouTube slot 5
powershell -ExecutionPolicy Bypass -File .\scripts\open-youtube-brave.ps1 -Slot 5

# Edge - Sosyal Medya slot 1
powershell -ExecutionPolicy Bypass -File .\scripts\open-social-edge.ps1 -Slot 1
```

## Flow Acma Komutlari

Varsayilan (Gemini-05 profili, tum tarayicilarda):

```powershell
pnpm open:flow
# veya
powershell -ExecutionPolicy Bypass -File .\scripts\open-flow-primary.ps1
```

Belirli tarayicida:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\open-flow-primary.ps1 -Browser edge
powershell -ExecutionPolicy Bypass -File .\scripts\open-flow-primary.ps1 -Browser brave
powershell -ExecutionPolicy Bypass -File .\scripts\open-flow-primary.ps1 -Browser chrome
```

## Ilk Kullanim

1. Uygun komutu calistir.
2. Acilan pencerede ilgili mail ile giris yap.
3. Tarayiciyi kapatsan bile profil klasoru korunur.
4. Ayni komutu tekrar acinca ayni hesap geri gelir.

## Oturum Guvenligi

- Profiller `.browser-profiles/` altinda tutulur.
- Bu klasor `.gitignore` ile commit disi kalir.
- Farkli hesaplar icin sekme degil, ayri profil kullanilir.
- Sekmeler arasi hesap karisikligi yasanmaz.

## Repo Siniri

- `scripts/open-*.ps1` ve `scripts/headless-*.ps1` dosyalari commit edilen operator helper tooling'dir.
- Gercek browser session verisi sadece `.browser-profiles/` altinda kalir ve release/runtime dependency sayilmaz.
