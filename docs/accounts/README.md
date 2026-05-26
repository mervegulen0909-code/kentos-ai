# AI Account Management

Bu klasor, ChatGPT ve Gemini hesaplarini guvenli sekilde takip etmek icin kullanilir.

Kurallar:

1. Gercek sifre, recovery code, cookie, token veya tam e-posta + sifre bilgisi bu klasore yazilmaz.
2. Repoya sadece maskeleme yapilmis hesap bilgileri ve kullanim kurallari girer.
3. Gercek sifreler Bitwarden, 1Password veya benzeri bir sifre yoneticisinde tutulur.
4. Her hesap icin sifre yoneticisinde tekil bir kayit adi kullanilir.
5. Bu repo icinde hangi hesabin hangi is icin kullanilacagi `accounts.example.md` ve `usage-rules.md` dosyalarinda takip edilir.

Otomatik kurulum:

1. `pnpm setup:ai-accounts`
2. Istersen repo alanlarini degistir: `pnpm setup:ai-accounts -- --repos repo-1,repo-2,repo-3 --manager 1Password --overwrite`
3. Script, yerelde `.accounts.local.md` ve `.accounts.machine.env` uretir.

Dosya siniflandirmasi:

- `docs/accounts/**` commit edilir; bunlar guvenli dokumantasyon ve operator rehberidir.
- repo kokundeki `.accounts.local.md`, `.accounts.machine.env`, `.api-keys.local.env`, `.accounts.local.example.md` ve `.browser-profiles/` local-only durumdur; release kapsaminda commit edilmez.
- `scripts/setup-ai-accounts.mjs`, `scripts/open-*.ps1`, ve `scripts/headless-*.ps1` operator helper scriptleridir; repo runtime dependency'si degil, bilincli tooling kapsamidir.

Plan ve kullanim kurallari:

- `usage-rules.md`
- `plan.md`
- `flow-plan.md`

Onerilen akıs:

1. `accounts.example.md` dosyasini kopyalayip ekip ihtiyaciniza gore doldurun.
2. Gercek sifreyi sadece sifre yoneticisine kaydedin.
3. Repo icinde sadece su bilgileri tutun:
   - platform
   - hesap etiketi
   - maskeleme yapilmis e-posta
   - sifre yoneticisi kayit adi
   - hangi repo/uygulama icin kullanilacagi
   - kullanim amaci

Yerel gizli not kullanimi:

- Bilgisayarinizda isterseniz repo kokunde `.accounts.local.md` olusturabilirsiniz.
- Bu dosya `.gitignore` icinde oldugu icin commit edilmez.
- Yine de bu dosyaya duz metin sifre yazmamaniz onerilir; sadece hatirlatici not tutun.
