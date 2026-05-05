# KentOS AI → PDF-benzeri Belediye Asistanı Dönüşüm Planı

## Amaç

Bu planın amacı, mevcut [`KentOS AI`](README.md) reposunu; belediye web sitesine gömülebilen, çok kanallı, konuşma tabanlı vatandaş asistanı ürününe evrimleştirmektir.

Mevcut omurga zaten güçlüdür:

- vatandaş başvurusu ticket’a dönüşüyor
- AI sınıflandırma var
- SLA ve audit akışı var
- admin operasyon paneli var
- vatandaş takip akışı var
- PWA kurulabilirliği eklendi

Bu nedenle yapılacak iş, çekirdeği baştan yazmak değil; ürün yüzlerini, kanal katmanlarını ve kurulum modelini genişletmektir.

## Hedef Ürün Tanımı

Hedef durumda ürün şu şekilde çalışır:

- belediye ana sayfasına veya alt sayfalarına tek script ile gömülebilen bir web asistanı olur
- vatandaş form doldurmak yerine sohbet ederek talep açabilir
- aynı intake hattı web widget, bağımsız PWA, WhatsApp ve ileride diğer kanallardan beslenir
- tüm görüşmeler ve başvurular tek ticket omurgasına akar
- admin panelinde kanal, otomasyon ve çözümleme metrikleri görünür
- belediye tenant yöneticisi widget kurulum kodunu panelden alabilir

## Mevcut Durum Özeti

Mevcut repo içinde kullanılabilecek hazır parçalar:

- vatandaş başvuru ekranı: [`apps/citizen-web/app/[tenantSlug]/report/page.tsx`](apps/citizen-web/app/[tenantSlug]/report/page.tsx)
- vatandaş takip ekranı: [`apps/citizen-web/app/[tenantSlug]/track/page.tsx`](apps/citizen-web/app/[tenantSlug]/track/page.tsx)
- vatandaş ticket detay ekranı: [`apps/citizen-web/app/[tenantSlug]/ticket/[trackingToken]/page.tsx`](apps/citizen-web/app/[tenantSlug]/ticket/[trackingToken]/page.tsx)
- public ticket oluşturma ve AI sınıflandırma: [`apps/api/src/modules/public/public-ticket.service.ts`](apps/api/src/modules/public/public-ticket.service.ts)
- admin operasyon paneli: [`apps/admin-web/app/page.tsx`](apps/admin-web/app/page.tsx)
- WhatsApp gateway sınırı: [`apps/whatsapp-gateway/src/main.ts`](apps/whatsapp-gateway/src/main.ts)

Ana eksikler:

- gömülebilir web widget yok
- chat-style vatandaş akışı yok
- çok adımlı follow-up konuşma state modeli ürünleşmiş değil
- kanal bazlı analitik görünür değil
- tenant için embed kurulum ekranı yok
- WhatsApp aynı intake omurgasına tam bağlanmış değil
- belediye anasayfasına kolay kurulum paketi yok

## Faz 0 — Hazırlık ve Mimari Sabitleme

Amaç: sonraki geliştirmeler başlamadan önce intake, kanal ve widget mimarisini sabitlemek.

Teslimatlar:

- hedef kanal mimarisi kararı
- ortak conversation ve session modeli kararı
- widget ile citizen PWA ilişkisinin tanımı
- tenant bazlı embed güvenlik yaklaşımı
- event ve analytics isimlendirme standardı

Yapılacak işler:

- mevcut public intake akışını belgelemek
- `CITIZEN_WEB` kanalının yanına yeni kanal tipleri ekleme planı çıkarmak
- conversation session için veri modeli tasarlamak
- follow-up soruların nasıl saklanacağını belirlemek
- widget origin doğrulama ve tenant eşleme modelini kararlaştırmak
- admin analytics için temel event sözlüğü hazırlamak

Çıkış kriteri:

- kodlamaya geçmeden önce veri modeli, API yüzeyi ve kanal sınırları netleşmiş olacak

## Faz 1 — Web Widget MVP

Amaç: belediye anasayfasına eklenebilen ilk embeddable asistanı çıkarmak.

Kapsam:

- bağımsız bir widget frontend paketi
- tek script ile siteye gömülme
- tenant bazlı yapılandırma
- temel sohbet açılış ekranı
- ticket oluşturma için mevcut public API entegrasyonu

Yapılacak işler:

- yeni bir widget uygulaması veya hafif embed bundle oluşturmak
- açılır sohbet kutusu UI geliştirmek
- tenant slug ile çalışan bootstrap script hazırlamak
- mevcut başvuru oluşturma hattına widget girişini bağlamak
- widget için temel rate limit ve abuse koruması planlamak
- belediye sitesinde çalışacak responsive ve erişilebilir görünüm hazırlamak

Çıkış kriteri:

- belediye sitesi sayfasına tek kod parçası ile eklenebilen çalışan widget demo’su

## Faz 2 — Sohbet Tabanlı Intake Akışı

Amaç: klasik form deneyimini konuşmalı deneyime dönüştürmek.

Kapsam:

- vatandaşın serbest metinle başlaması
- sistemin eksik bilgileri konuşarak tamamlaması
- konuşma sonunda ticket açılması
- takip kodunun konuşma içinde verilmesi

Yapılacak işler:

- conversation session API uçları tasarlamak
- mesaj gönder/al döngüsü oluşturmak
- AI follow-up alanlarını UI’da görünür hale getirmek
- eksik alanlar tamamlandığında ticket create tetiklemek
- vatandaşa konuşma sonunda takip kodu ve sonraki adımı göstermek
- mevcut form akışını yedek giriş olarak korumak

Çıkış kriteri:

- kullanıcı form doldurmadan yalnızca sohbet ederek başvuru açabilmeli

## Faz 3 — Ortak Kanal Omurgası

Amaç: web widget, PWA ve WhatsApp girişlerini aynı intake çekirdeğinde toplamak.

Kapsam:

- ortak conversation domain modeli
- kanal bağımsız intake orchestration
- public ticket create sürecinin conversation-aware hale gelmesi
- webhook veya provider mesajlarının normalize edilmesi

Yapılacak işler:

- kanal bağımsız message envelope tipi tanımlamak
- widget ve citizen web mesajlarını aynı servise bağlamak
- WhatsApp gateway’den gelen normalize mesajları intake hattına aktarmak
- kanal bazlı citizen kimlik eşleme mantığı tasarlamak
- audit log içine kanal-temelli konuşma olaylarını eklemek
- retry ve idempotency davranışlarını netleştirmek

Çıkış kriteri:

- aynı ticket motoru en az web widget ve WhatsApp girişini desteklemeli

## Faz 4 — WhatsApp Ürünleşmesi

Amaç: PDF’deki çok kanallı değeri görünür hale getirmek için WhatsApp hattını gerçek kullanım seviyesine çıkarmak.

Kapsam:

- inbound mesaj akışı
- follow-up soruları WhatsApp üzerinden sorma
- ticket açılışı ve takip kodu dönüşü
- temel operatör devri mantığı

Yapılacak işler:

- gateway tarafında provider event normalizasyonunu tamamlamak
- public intake servisini WhatsApp mesajlarıyla konuşturmak
- konuşma durumu ile telefon numarası eşleme mantığını oturtmak
- otomatik cevap ve insan devri koşullarını belirlemek
- WhatsApp template ve bilgilendirme mesajlarını tenant bazlı yönetmek
- hata durumları için güvenli fallback mesajları eklemek

Çıkış kriteri:

- vatandaş WhatsApp üzerinden yazıp ticket açabilmeli ve takip kodu alabilmeli

## Faz 5 — Admin Paneli Analitik ve Operasyon Zenginleştirme

Amaç: sistemi yalnızca intake aracı değil, ölçülebilir belediye operasyon ürünü haline getirmek.

Kapsam:

- kanal bazlı dashboard
- otomasyon oranı
- AI follow-up başarı oranı
- insan devri oranı
- çözüm süresi ve SLA görünürlüğü

Yapılacak işler:

- yeni analytics event alanları tanımlamak
- dashboard kartlarını kanal ve otomasyon ekseninde genişletmek
- raporlara intake funnel görünümü eklemek
- vatandaş ilk temasından ticket kapanışına kadar dönüşüm zinciri çıkarmak
- operasyon ekipleri için “AI tamamladı / operatöre düştü / eksik bilgi bekliyor” segmentleri eklemek

Çıkış kriteri:

- belediye yöneticisi hangi kanalın ne kadar başvuru ürettiğini ve otomasyonun ne kadar çalıştığını görebilmeli

## Faz 6 — Tenant Self-Serve Kurulum

Amaç: ürünün satışa ve kuruma teslim edilebilir hale gelmesi.

Kapsam:

- admin panelinden widget kurulum ekranı
- tenant bazlı script kodu
- görünüm ve davranış ayarları
- kurulum doğrulama adımları

Yapılacak işler:

- admin paneline web asistanı ayar ekranı eklemek
- embed script üretmek
- renk, başlık, karşılama mesajı ve çalışma saatleri gibi ayarları tenant config’e bağlamak
- belediye teknik ekibi için kısa kurulum dokümanı üretmek
- widget yüklenme durumu ve bağlantı testini panelden göstermek

Çıkış kriteri:

- teknik ekip panelden kodu alıp belediye sitesine ekleyebilmeli

## Faz 7 — Gelişmiş Kanallar ve Operatör Devri

Amaç: PDF’deki ürün anlatımına yaklaşan tam kanal stratejisine ilerlemek.

Kapsam:

- Instagram veya Facebook DM için adaptör hazırlığı
- SMS fallback mantığı
- çağrı merkezi operatör giriş ekranı
- insan temsilciye canlı devir kuralları

Yapılacak işler:

- yeni kanal adapter sözleşmesi tanımlamak
- operatörün konuşma geçmişi üzerinden ticket açmasını kolaylaştırmak
- mesaj bazlı assignment ve escalation kuralları tasarlamak
- hassas durumlar için insan müdahale akışı eklemek

Çıkış kriteri:

- sistem sadece web ve WhatsApp değil, yeni kanal genişlemesine hazır hale gelmeli

## Faz 8 — Güvenlik, KVKK ve Üretim Sertleştirme

Amaç: canlı belediye kullanımı için güvenli ve denetlenebilir ürün seviyesi oluşturmak.

Kapsam:

- tenant izolasyonu
- origin kontrolü
- abuse koruması
- kişisel veri işleme sınırları
- log ve audit sertleştirmesi

Yapılacak işler:

- widget embed origin allowlist tasarlamak
- public endpoint rate limit ve bot koruması eklemek
- kişisel veri masking ve retention politikalarını netleştirmek
- audit olaylarını anlamlı mutation seviyesinde genişletmek
- güvenlik ve KVKK kontrol listesini güncellemek

Çıkış kriteri:

- ürün belediye canlı ortamı için temel güvenlik ve veri yönetişimi şartlarını karşılamalı

## Faz 9 — Test, Demo ve Release Hazırlığı

Amaç: yeni ürün yüzlerinin gösterilebilir ve sürdürülebilir biçimde yayına hazırlanması.

Kapsam:

- widget E2E testleri
- sohbet intake testleri
- WhatsApp akış smoke testleri
- demo tenant senaryoları
- release ve rollback dokümantasyonu

Yapılacak işler:

- Playwright kapsamını widget ve chat akışlarıyla genişletmek
- kanal bazlı contract testleri eklemek
- belediye demo senaryoları hazırlamak
- dokümantasyon ve release checklist’i güncellemek
- canlı öncesi smoke akışını netleştirmek

Çıkış kriteri:

- ürün demo, pilot ve rollout için doğrulanmış olacak

## Fazlar Arası Öncelik Sırası

Önerilen uygulama sırası:

1. Faz 0 — Hazırlık ve mimari sabitleme
2. Faz 1 — Web widget MVP
3. Faz 2 — Sohbet tabanlı intake
4. Faz 3 — Ortak kanal omurgası
5. Faz 4 — WhatsApp ürünleşmesi
6. Faz 5 — Admin analitik zenginleştirme
7. Faz 6 — Tenant self-serve kurulum
8. Faz 8 — Güvenlik ve üretim sertleştirme
9. Faz 9 — Test ve release hazırlığı
10. Faz 7 — Gelişmiş kanallar ve operatör devri

Bu sıra bilinçli olarak seçildi. Önce web widget ve konuşma deneyimi ile ürün görünür hale gelir. Sonra kanallar birleşir. Sonra ölçüm, kurulum ve sertleştirme gelir. En son ileri kanal genişlemeleri yapılır.

## İlk Uygulama Dalgası Önerisi

İlk gerçek geliştirme dalgasında yalnızca şu fazlar alınmalı:

- Faz 0
- Faz 1
- Faz 2

Bu üç faz bittiğinde ürün artık şunları sunar:

- belediye sitesine gömülebilen asistan
- vatandaşın sohbet ederek başvuru açabilmesi
- mevcut ticket omurgasının yeniden kullanılması
- PDF’deki ürün hissine yaklaşan ilk görünür deneyim

## Bağımlılıklar ve Dikkat Noktaları

- widget mimarisi tenant izolasyonunu bozmamalı
- WhatsApp mantığı gateway içinde iş kurallarına dönüşmemeli
- staff-only veri vatandaş kanallarına sızmamalı
- audit kapsamı yeni konuşma olayları için genişletilmeli
- mevcut form tabanlı akış bir süre korunmalı
- Prisma file-lock sorunu geliştirme akışında ayrıca ele alınmalı

## Uygulama İçin Hazır Sonraki Adım

Uygulamaya geçerken en mantıklı başlangıç noktası:

- Faz 0 için teknik spec çıkarılması
- ardından Faz 1 için widget MVP dosya ve paket yapısının oluşturulması
- sonra Faz 2 için conversation session API tasarımı

Bu sırayla ilerlendiğinde repo kontrollü biçimde PDF’deki ürün özelliklerine yaklaşır.
