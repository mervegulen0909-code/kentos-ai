# Flow Usage Plan

Bu plan Google Flow kullanimini tanimlar.

## Temel Kural

Google Flow, bu repoda sadece gerektiginde kullanilacak premium video aracidir.

Varsayilan ilk secenek:

1. `Gemini account-05`
2. Google AI Ultra uyeligi
3. `Gemini-05` browser profili
4. Google Flow: `https://labs.google/fx/tr/tools/flow`

Ikinci video secenegi:

1. `tysonholt` hesabi
2. yaklasik `1000 kredi`
3. birincil Ultra duzeni uygun degilse veya kredi dagitimi gerekiyorsa kullanilir

## Ne Icin Kullanilacak

Flow su tur islerde kullanilabilir:

- premium video uretimi
- yaratıcı video denemeleri
- referans gorselden video
- sahne, storyboard veya klip tabanli video isleri
- repo icindeki video ihtiyaclari

## Ne Zaman Kullanilacak

Sadece su durumlarda acilacak:

- standart metin/gorsel araclari yetersiz kalirsa
- acikca video uretimi gerekiyorsa
- kaliteli veya premium Gemini/Flow sonucu isteniyorsa
- mevcut kredi kullanimi mantikliysa

## Ne Zaman Kullanilmayacak

Sunlar icin varsayilan secenek degildir:

- basit yazi isleri
- normal kodlama gorevleri
- repo ici genel sohbet
- gereksiz deneme ve kredi tuketimi

## Kredi Kurali

Yerel notlara gore Flow icin yaklasik `10.000 kredi` ayrilmistir.

Ek ikinci kaynak:

- `tysonholt` hesabi
- yaklasik `1000 kredi`

Kural:

1. once gercek ihtiyac kontrol edilir
2. sonra `Gemini-05 / Ultra` ile Flow acilir
3. gerekiyorsa `tysonholt` hesabi ikinci secenek olarak kullanilir
4. sorun olursa diger Gemini hesaplarina gecilir

Fallback sirasi:

1. `Gemini-05`
2. `tysonholt`
3. `Gemini-04`
4. `Gemini-06`

## Acma Yontemi

Repo icinden acmak icin:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\open-flow-primary.ps1
```

Belirli browser:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\open-flow-primary.ps1 -Browser edge
powershell -ExecutionPolicy Bypass -File .\scripts\open-flow-primary.ps1 -Browser brave
powershell -ExecutionPolicy Bypass -File .\scripts\open-flow-primary.ps1 -Browser chrome
```

Ucunde birden:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\open-flow-primary.ps1 -Browser all
```

## Teknik Not

Bu yapida Flow, browser profili ile kullanilir.

- ilk tercih `Gemini-05`
- login mevcut profilden gelir
- repo sadece acma duzenini ve kullanim kuralini yonetir
