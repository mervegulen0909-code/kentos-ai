# Account And Membership Plan

Bu plan, repo icindeki AI hesaplari, Gemini uyeligi ve yerel API key duzeninin nasil kullanilacagini tanimlar.

## Temel Kural

Gemini ile ilgili tum repo islerinde ilk tercih her zaman:

1. Google AI Ultra uyeligi olan Gemini hesabi
2. bu uyelige bagli birincil Gemini API key
3. sorun olursa diger Gemini hesaplari

Bu kurala gore varsayilan ilk hesap:

- `Gemini account-05`
- `fil***@gmail.com`
- Gemini Ultra

Varsayilan ilk API key:

- yerel `.api-keys.local.env` dosyasindaki `GEMINI_PRIMARY_API_KEY`

## Bu Uyeligi Ne Icin Kullanacagiz

Bu uyelik ve API duzeni kod yazdirmak icin birincil secenek olarak dusunulmez.

Repo icinde uygun kullanimlar:

- Gemini tabanli arastirma
- uzun icerik inceleme ve ozetleme
- alternatif ikinci gorus
- is akisi destekleri
- repo disi Gemini uygulama kullanimlari
- Gemini gerektiren hesap bazli isler

## Bu Uyeligi Ne Icin Kullanmayacagiz

Varsayilan olarak su islerde birincil secenek olmayacak:

- repo icinde ana kodlama asistani olarak
- mevcut Claude / diger kod odakli akislari bozacak sekilde
- her gorevde otomatik zorunlu model secimi olarak

## Oncelik Sirasi

Gemini gerektiren bir is oldugunda sira:

1. `GEMINI_PRIMARY_API_KEY`
2. `Gemini account-05`
3. `Gemini account-04`
4. `Gemini account-06`

ChatGPT gerektiren islerde mevcut ChatGPT hesap sirasi korunur.

## Repo Icine Uygulama Kurali

Repo icinde herhangi bir otomasyon, not, komut veya kullanim talimati yazilirken:

- Gemini tarafinda ilk varsayilan olarak `Gemini account-05` kabul edilir
- API tabanli kullanim gerekiyorsa ilk varsayilan olarak `GEMINI_PRIMARY_API_KEY` kabul edilir
- bu iki secenek calismazsa diger Gemini hesaplarina gecilir

## Flow Onceligi

Google Flow gerektiren video islerinde ilk tercih her zaman:

1. `Gemini account-05`
2. Google AI Ultra uyeligi
3. yerel birincil Gemini duzeni

Ikinci tercih:

1. `tysonholt` hesabi
2. yaklasik `1000 kredi`
3. video uretiminde sadece gerektiginde kullanilir

Flow sadece gerektiginde acilir; varsayilan gunluk kullanim araci degildir.

## Yerel Dosyalar

Bu duzen su yerel dosyalarla yonetilir:

- `.accounts.local.md`
- `.accounts.machine.env`
- `.api-keys.local.env`

Bu dosyalar commit edilmez.
