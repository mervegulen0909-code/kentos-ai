# Usage Rules

Bu kurallar 5 hesabi 3 repo veya 3 farkli uygulama alaninda ayni duzenle kullanmak icindir.

## Rol Dagilimi

| Rol | Onerilen Hesap | Kullanim |
| --- | --- | --- |
| Genel kodlama | ChatGPT account-01 | Gecelik/gunluk genel gelistirme |
| Frontend | ChatGPT account-02 | UI, metin duzenleme, component isi |
| Backend | ChatGPT account-03 | API, veritabani, test |
| Gemini varsayilan | Gemini account-05 | Gemini islerinde ilk kullanilacak hesap |
| Ikinci gorus | Gemini account-04 | Alternatif yaklasim, kontrol |
| Yedek | Gemini account-06 | Kota dolunca veya ayri is akisi gerektiginde |

## Gemini Oncelik Kurali

Gemini tabanli tum islerde varsayilan ilk hesap `Gemini account-05` olmalidir.

Bu hesap:

- `fil***@gmail.com`
- Gemini Ultra
- Chrome / Brave / Edge icinde `Gemini-05` profili ile acilir

Kullanim sirasi:

1. `Gemini account-05`
2. `Gemini account-04`
3. `Gemini account-06`

## Gemini API Key Kurali

Gemini API tabanli tum islerde varsayilan ilk anahtar yerel `.api-keys.local.env` dosyasindaki birincil anahtar olmalidir.

Kural:

1. once birincil Gemini API key
2. sorun olursa Gemini account-05
3. sonra Gemini account-04
4. sonra Gemini account-06

## Repo Bazli Ornek Dagilim

| Repo | Ana Hesap | Destek Hesap | Not |
| --- | --- | --- | --- |
| repo-1 | ChatGPT account-01 | Gemini account-04 | Genel urun gelistirme |
| repo-2 | ChatGPT account-03 | Gemini account-05 | Backend agirlikli isler |
| repo-3 | ChatGPT account-02 | Gemini account-04 | Frontend ve icerik |

## Tarayici Profili Kurali

Karismayi engellemek icin her hesap icin ayri tarayici profili kullanilir.
Sekme degil profil mantigi zorunludur.

| Tarayici | Proje | Profiller |
| --- | --- | --- |
| Chrome | Etsy | ChatGPT-01, ChatGPT-02, ChatGPT-03, Gemini-04, Gemini-05, Gemini-06 |
| Brave | YouTube | ChatGPT-01, ChatGPT-02, ChatGPT-03, Gemini-04, Gemini-05, Gemini-06 |
| Edge | Sosyal Medya | ChatGPT-01, ChatGPT-02, ChatGPT-03, Gemini-04, Gemini-05, Gemini-06 |

Toplam: 18 ayri profil / oturum.

Acma komutlari:

```powershell
pnpm open:etsy      # Chrome 6 profil
pnpm open:youtube   # Brave 6 profil
pnpm open:social    # Edge 6 profil
pnpm open:all       # Tum 18 profil
pnpm open:flow      # Gemini-05 Flow acilisi
```

## Guvenlik Kurali

Sunlari repoya koymayin:

- duz metin sifre
- tam e-posta + sifre ayni satirda
- backup code
- API key
- session cookie

Sunlari repoya koyabilirsiniz:

- maskeleme yapilmis e-posta
- hesap etiketi
- sifre yoneticisi kayit adi
- hangi repo veya uygulamada kullanilacagi
- kullanim amaci

## Uygulama Adimlari

1. Her hesap icin sifre yoneticisinde bir kayit olusturun.
2. Her hesap icin ayri browser profile acin.
3. `accounts.example.md` icinde maskeli hesap kaydini girin.
4. Her repo icin ana ve yedek hesabi belirleyin.
5. Yeni hesap eklenirse ayni isimlendirme kuralini koruyun.
