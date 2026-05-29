# KentOS AI — Konuşan AI Maskotu (Belediye Dijital Asistanı)

> Vatandaşın belediyeyle tek cümleyle konuştuğu, sorularını **gerçek yapay zeka** ile
> yanıtlayan ve gerektiğinde talep (ticket) oluşturup takip kodu veren yüzen asistan.

## Ne yapar?
- **Tüm vatandaş portalı sayfalarında** (başvuru, takip, SSS, randevu, ticket, hesap) sağ-altta yüzen maskot.
- **Karşılıklı (çok-turlu) sohbet:** Vatandaş soru sorar → maskot doğal Türkçe cevap verir.
- **Üretken AI yanıtı:** OpenAI `gpt-4o`. Belediyenin **SSS makaleleri + hazır yanıtları + birim/kategori listesi** ile beslenir (grounding). Bilgi tabanı büyüdükçe maskot gelişir.
- **Güvenli:** Kesin bilgi (tarih/ücret) uydurmaz; bilmediğinde doğru birime/talebe yönlendirir.
- **Talep oluşturma:** Şikâyet/istek anlaşıldığında ticket açar ve **TK takip kodu** verir; konum/iletişim opsiyoneldir (başvuru formuyla aynı kural).
- **AI bütçe guard + telemetri:** Her yanıt `aiRun` olarak kaydedilir (`purpose: public-conversation-answer`), tenant AI bütçesine tabidir.

## Yerel uçtan uca doğrulama (kanıt)
http://localhost:3102/demo-belediye/report üzerinde test edildi:
1. **Genel soru:** "Çöp ne zaman toplanıyor?" → gerçek üretken cevap (153 çağrı merkezi + talep oluşturma önerisi; gün uydurmadı). `aiRun`: provider **openai**, model **gpt-4o**, success, 2134 token.
2. **Çok-turlu rehberli intake:** Sokak lambası şikâyeti → maskot eksik konumu sordu → konum verildi → "Evet oluşturun" → **ticket açıldı: TK-7F10B5A86E204142**.
3. Intake sınıflandırması da OpenAI gpt-4o kullanıyor (Anthropic→OpenAI migrasyonu çalışıyor).

## Değişen / eklenen dosyalar
- `apps/api/src/modules/public/public-ticket.service.ts` — `answerConversation`, `buildConversationSystemPrompt`, `recordConversationRun` (üretken yanıt + telemetri, mevcut OpenAI altyapısı reuse).
- `apps/api/src/modules/public/public-conversation.service.ts` — `processMessage`: `general_question`/yanıtsız dalda üretken yanıt; çok-turlu intake için son vatandaş mesajları birleştirilip sınıflandırılır; yalnız `description` eksikse talep bloklanır; `listTenantFaq` + `listTenantCannedReplies`.
- `apps/citizen-web/app/components/floating-mascot.tsx` — yüzen maskot + çok-turlu sohbet (client).
- `apps/citizen-web/app/components/mascot-avatar.tsx` — özgün SVG karakter (CSS animasyon).
- `apps/citizen-web/app/components/mascot-actions.ts` — server action (CORS'suz API çağrısı).
- `apps/citizen-web/app/[tenantSlug]/layout.tsx` — maskotu tüm tenant sayfalarına monte eder.
- `apps/citizen-web/app/globals.css` — `.mascot-*` stilleri + animasyonlar.
- `packages/database/prisma/seed.ts` — başlangıç bilgi tabanı: 12 SSS makalesi + 3 hazır yanıt (idempotent).

## Doğrulama komutları (hepsi geçti ✅)
- `pnpm --filter @kentos/api typecheck`
- `pnpm --filter @kentos/citizen-web typecheck`
- `pnpm --filter @kentos/database typecheck`

## Canlıya alma (DEPLOY GEREKİR)
Repo değişiklikleri canlıyı otomatik güncellemez. Canlıda devreye almak için:
1. **Sağlayıcı:** Canlı şu an deploy edilmiş eski sürümde. Bu branch **OpenAI-only**; deploy ile sunucudaki `.env.production.local` içinde **`OPENAI_API_KEY` ayarlı olmalı** (yerelde kök `.env`'de çalışan anahtar mevcut — değer paylaşılmadı). `OPENAI_MODEL` opsiyonel (vars. `gpt-4o`).
2. **Bilgi tabanı:** Deploy sonrası `pnpm db:seed` çalıştır → SSS + hazır yanıtlar canlı demo tenant'a yüklenir (idempotent). Belediyeye özel içerik admin panelinden genişletilebilir (maskot otomatik öğrenir).
3. **Build + restart:** API + citizen-web yeniden build/deploy edilir (DEPLOYMENT.md / docker compose prod).
4. Doğrula: `/demo-belediye/report` sağ-altta maskot; bir soru sor → gerçek cevap; admin → Raporlar → AI kullanım: `public-conversation-answer / openai` kayıtları görünür.

## Notlar
- Maskot `widgetEnabled=false` ise gösterilmez (tenant ayarı).
- `prefers-reduced-motion` desteklenir (animasyonlar kapanır).
- Sıfır yeni bağımlılık (saf SVG + CSS); React 19 uyumlu.
