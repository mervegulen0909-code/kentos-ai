import { ChannelType, PrismaClient, TicketPriority, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const departments = [
  ['TEMIZLIK', 'Temizlik Isleri'],
  ['FEN_ISLERI', 'Fen Isleri'],
  ['PARK_BAHCELER', 'Park ve Bahceler'],
  ['ZABITA', 'Zabita'],
  ['SOSYAL_YARDIM', 'Sosyal Yardim'],
  ['KULTUR_SOSYAL', 'Kultur ve Sosyal Isler'],
  ['SU_KANALIZASYON', 'Su ve Kanalizasyon'],
  ['VETERINER', 'Veteriner Isleri'],
  ['ULASIM', 'Ulasim'],
  ['RUHSAT_DENETIM', 'Ruhsat ve Denetim'],
  ['MALI_HIZMETLER', 'Mali Hizmetler'],
  ['BEYAZ_MASA', 'Beyaz Masa / Cagri Merkezi'],
] as const;

const categories = [
  ['COP_TOPLAMA', 'Cop toplama / konteyner', 'TEMIZLIK', TicketPriority.NORMAL],
  ['YOL_KALDIRIM', 'Yol, kaldirim ve asfalt', 'FEN_ISLERI', TicketPriority.HIGH],
  ['PARK_BAKIM', 'Park bakim ve oyun alani', 'PARK_BAHCELER', TicketPriority.NORMAL],
  ['GURULTU_ISGAL', 'Gurultu, isgal ve denetim', 'ZABITA', TicketPriority.HIGH],
  ['SOKAK_HAYVANI', 'Sokak hayvani ve veterinerlik', 'VETERINER', TicketPriority.NORMAL],
  ['SU_ARIZA', 'Su ve kanalizasyon arizasi', 'SU_KANALIZASYON', TicketPriority.URGENT],
  ['TRAFIK_ULASIM', 'Trafik ve ulasim', 'ULASIM', TicketPriority.HIGH],
  ['GENEL_BASVURU', 'Genel basvuru', 'BEYAZ_MASA', TicketPriority.NORMAL],
] as const;

const templates = [
  ['TICKET_RECEIVED', 'Talebiniz alinmistir. Takip kodunuz: {{trackingToken}}.'],
  ['TICKET_ROUTED', 'Talebiniz {{departmentName}} birimine aktarilmistir. Takip kodunuz: {{trackingToken}}.'],
  ['TICKET_IN_PROGRESS', '{{trackingToken}} takip kodlu talebiniz icin islem devam etmektedir.'],
  ['TICKET_RESOLVED', '{{trackingToken}} takip kodlu talebiniz cozumlenmistir. Geri bildiriminiz bizim icin degerlidir.'],
  ['INFO_REQUESTED', '{{trackingToken}} takip kodlu talebiniz icin ek bilgiye ihtiyac duyuyoruz: {{question}}'],
] as const;

const demoWidgetAllowedOrigins = [
  'http://127.0.0.1:3002',
  'http://localhost:3002',
  'http://127.0.0.1:3112',
  'http://localhost:3112',
] as const;

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-belediye' },
    update: {
      widgetEnabled: true,
      widgetTitle: 'Demo Belediyesi Asistanı',
      widgetWelcome: 'Merhaba, Demo Belediyesi asistanına hoş geldiniz. Talebinizi yazın, doğru birime aktaralım.',
      widgetAllowedOrigins: [...demoWidgetAllowedOrigins],
    },
    create: {
      name: 'Demo Belediyesi',
      slug: 'demo-belediye',
      timezone: 'Europe/Istanbul',
      locale: 'tr-TR',
      widgetEnabled: true,
      widgetTitle: 'Demo Belediyesi Asistanı',
      widgetWelcome: 'Merhaba, Demo Belediyesi asistanına hoş geldiniz. Talebinizi yazın, doğru birime aktaralım.',
      widgetAllowedOrigins: [...demoWidgetAllowedOrigins],
    },
  });

  const departmentByCode = new Map<string, string>();

  for (const [code, name] of departments) {
    const department = await prisma.department.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: { name, isActive: true },
      create: { tenantId: tenant.id, code, name },
    });

    departmentByCode.set(code, department.id);
  }

  for (const [code, name, departmentCode, defaultPriority] of categories) {
    await prisma.category.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: {
        name,
        defaultPriority,
        departmentId: departmentByCode.get(departmentCode),
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        code,
        name,
        defaultPriority,
        departmentId: departmentByCode.get(departmentCode),
      },
    });
  }

  for (const priority of Object.values(TicketPriority)) {
    const resolutionMinutes = {
      LOW: 7 * 24 * 60,
      NORMAL: 3 * 24 * 60,
      HIGH: 24 * 60,
      URGENT: 4 * 60,
    }[priority];

    const existingPolicy = await prisma.slaPolicy.findFirst({
      where: {
        tenantId: tenant.id,
        departmentId: null,
        categoryId: null,
        priority,
      },
    });

    if (existingPolicy) {
      await prisma.slaPolicy.update({
        where: { id: existingPolicy.id },
        data: {
          responseMinutes: priority === TicketPriority.URGENT ? 30 : 4 * 60,
          resolutionMinutes,
          isActive: true,
        },
      });
    } else {
      await prisma.slaPolicy.create({
        data: {
          tenantId: tenant.id,
          priority,
          responseMinutes: priority === TicketPriority.URGENT ? 30 : 4 * 60,
          resolutionMinutes,
        },
      });
    }
  }

  for (const [key, body] of templates) {
    const existingTemplate = await prisma.messageTemplate.findFirst({
      where: { tenantId: tenant.id, key, locale: 'tr-TR', channel: null },
    });

    if (existingTemplate) {
      await prisma.messageTemplate.update({
        where: { id: existingTemplate.id },
        data: { body, isActive: true },
      });
    } else {
      await prisma.messageTemplate.create({
        data: { tenantId: tenant.id, key, locale: 'tr-TR', channel: null, body },
      });
    }
  }

  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo.local' } },
    update: { passwordHash, role: UserRole.TENANT_ADMIN, isActive: true },
    create: {
      tenantId: tenant.id,
      email: 'admin@demo.local',
      passwordHash,
      fullName: 'Demo Belediye Yoneticisi',
      role: UserRole.TENANT_ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'readonly@demo.local' } },
    update: { passwordHash, role: UserRole.READ_ONLY, isActive: true },
    create: {
      tenantId: tenant.id,
      email: 'readonly@demo.local',
      passwordHash,
      fullName: 'Demo Salt Okuma Kullanicisi',
      role: UserRole.READ_ONLY,
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'manager@demo.local' } },
    update: { passwordHash, role: UserRole.MANAGER, isActive: true },
    create: {
      tenantId: tenant.id,
      email: 'manager@demo.local',
      passwordHash,
      fullName: 'Demo Operasyon Yonetici',
      role: UserRole.MANAGER,
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'operator@demo.local' } },
    update: { passwordHash, role: UserRole.OPERATOR, isActive: true },
    create: {
      tenantId: tenant.id,
      email: 'operator@demo.local',
      passwordHash,
      fullName: 'Demo Operator Kullanicisi',
      role: UserRole.OPERATOR,
    },
  });

  const fenDepartmentId = departmentByCode.get('FEN_ISLERI');
  if (!fenDepartmentId) throw new Error('FEN_ISLERI department was not seeded.');

  const departmentStaff = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'fen.staff@demo.local' } },
    update: { passwordHash, role: UserRole.DEPARTMENT_STAFF, isActive: true },
    create: {
      tenantId: tenant.id,
      email: 'fen.staff@demo.local',
      passwordHash,
      fullName: 'Demo Fen Isleri Personeli',
      role: UserRole.DEPARTMENT_STAFF,
    },
  });

  await prisma.userDepartment.upsert({
    where: { userId_departmentId: { userId: departmentStaff.id, departmentId: fenDepartmentId } },
    update: {},
    create: { userId: departmentStaff.id, departmentId: fenDepartmentId },
  });

  await seedDemoChannelData(tenant.id);
  await seedKnowledgeBase(tenant.id);
}

// Maskot/asistan bilgi katmani: SSS makaleleri + paylasimli hazir yanitlar.
// Idempotent (slug/title bazli upsert) — her db:seed calistiginda guvenli.
const faqArticles: Array<[string, string, string]> = [
  [
    'cop-toplama',
    'Cop ve konteyner toplama saatleri',
    'Evsel atiklar mahalleye gore haftanin belirli gunlerinde, genellikle aksam saatlerinde toplanir. Konteyner dolulugu, hasarli konteyner veya yeni konteyner talebi icin "Cop toplama / konteyner" kategorisinden basvuru olusturabilirsiniz. Toplama gun ve saatleri mahalleye gore degisebilir; net bilgi icin adresinizi belirterek talep acin.',
  ],
  [
    'su-kesintisi',
    'Su kesintisi ve su arizasi bildirimi',
    'Planli su kesintileri onceden duyurulur. Ani su kesintisi, boru patlagi, sayac veya kanalizasyon arizasi icin "Su ve kanalizasyon arizasi" kategorisinden, adres ve mumkunse fotograf ekleyerek talep olusturun. Acil durumlar yuksek oncelikle ekibe yonlendirilir.',
  ],
  [
    'yol-kaldirim',
    'Yol, kaldirim ve asfalt onarimi',
    'Bozuk yol, cokmus asfalt, kirik kaldirim tasi veya tehlikeli cukur bildirimleri Fen Isleri birimine yonlendirilir. Konumu (mahalle/sokak) ve varsa fotografi ekleyerek talep olusturmaniz ekibin daha hizli mudahale etmesini saglar.',
  ],
  [
    'sokak-aydinlatma',
    'Sokak aydinlatmasi ve lamba arizasi',
    'Yanmayan veya arizali sokak lambalari icin adres tarifi vererek talep olusturabilirsiniz. Aydinlatma bazi bolgelerde dagitim sirketinin sorumlulugunda olabilir; talebiniz dogru birime yonlendirilir.',
  ],
  [
    'imar-ruhsat',
    'Imar durumu ve yapi ruhsati',
    'Imar durumu, yapi ruhsati ve iskan islemleri Ruhsat ve Denetim birimi tarafindan yurutulur. Gerekli belgeler ve surec hakkinda bilgi almak ya da basvuru baslatmak icin talep olusturabilir veya e-randevu alabilirsiniz.',
  ],
  [
    'emlak-vergisi',
    'Emlak ve cevre temizlik vergisi',
    'Emlak vergisi ve cevre temizlik vergisi taksitleri yilda iki donemde odenir. Tahakkuk, borc sorgusu ve odeme islemleri Mali Hizmetler birimi tarafindan yurutulur. Detayli bilgi icin talep olusturabilirsiniz.',
  ],
  [
    'nikah-nufus',
    'Nikah ve evlilik islemleri',
    'Resmi nikah islemleri icin gerekli belgeler ve randevu Kultur ve Sosyal Isler / evlendirme birimi uzerinden yurutulur. Uygun gun ve saat icin e-randevu alabilir, gerekli evraklar icin bilgi talep edebilirsiniz.',
  ],
  [
    'sokak-hayvani',
    'Sokak hayvanlari ve veteriner hizmetleri',
    'Sahipsiz hayvanlarin kisirlastirilmasi, tedavisi, asilanmasi ve yaralı hayvan bildirimleri Veteriner Isleri birimine iletilir. Konum bilgisi vererek talep olusturmaniz mudahaleyi hizlandirir.',
  ],
  [
    'gurultu-sikayet',
    'Gurultu, isgal ve denetim sikayetleri',
    'Asiri gurultu, kaldirim/yol isgali, ruhsatsiz faaliyet gibi konular Zabita birimine iletilir. Sikayetinizi adres ve saat bilgisiyle olusturmaniz denetimin etkinligini artirir.',
  ],
  [
    'e-randevu',
    'E-randevu nasil alinir?',
    'Belediye hizmetleri icin internetten randevu alabilirsiniz. "E-Randevu" sayfasindan uygun gun ve saati secip ad-soyad ve telefon bilginizle randevunuzu olusturabilirsiniz. Randevu kodunuzu daha sonra islemler sirasinda kullanabilirsiniz.',
  ],
  [
    'takip-kodu',
    'Basvuru takip kodu (TK) nasil kullanilir?',
    'Her basvuru olusturuldugunda size TK- ile baslayan gizli bir takip kodu verilir. "Basvuru Takibi" sayfasina bu kodu girerek talebinizin durumunu, ilgili birimi ve belediye mesajlarini gorebilirsiniz. Takip kodunuzu baskasiyla paylasmayin.',
  ],
  [
    'kvkk-veri-silme',
    'Kisisel verilerim ve veri silme hakki (KVKK)',
    'Kisisel verileriniz KVKK kapsaminda islenir. Verilerinizin anonimlestirilmesini talep edebilirsiniz; bu durumda kimlik bilgileriniz anonim hale getirilir, basvurular teknik kayit olarak korunur. Talebinizi hesap sayfanizdaki veri silme adimindan iletebilirsiniz.',
  ],
];

const cannedReplies: Array<[string, string]> = [
  ['Cop toplama yonlendirme', 'Cop toplama ve konteyner talepleriniz Temizlik Isleri birimine iletilmektedir. Adres bilginizi paylasirsaniz ekibimiz en kisa surede ilgilenir.'],
  ['Su arizasi yonlendirme', 'Su ve kanalizasyon arizalari Su ve Kanalizasyon birimine acil olarak iletilir. Konum ve varsa fotograf eklemeniz mudahaleyi hizlandirir.'],
  ['Tesekkur ve kapanis', 'Belediyemize ulastiginiz icin tesekkur ederiz. Talebinizin durumunu takip kodunuzla istediginiz zaman izleyebilirsiniz. Iyi gunler dileriz.'],
];

async function seedKnowledgeBase(tenantId: string) {
  for (const [slug, title, body] of faqArticles) {
    await prisma.faqArticle.upsert({
      where: { tenantId_slug_lang: { tenantId, slug, lang: 'tr' } },
      update: { title, body, isPublished: true },
      create: { tenantId, slug, lang: 'tr', title, body, isPublished: true },
    });
  }

  for (const [title, body] of cannedReplies) {
    const existing = await prisma.cannedReply.findFirst({ where: { tenantId, ownerId: null, title } });
    if (existing) {
      await prisma.cannedReply.update({ where: { id: existing.id }, data: { body, isActive: true } });
    } else {
      await prisma.cannedReply.create({ data: { tenantId, ownerId: null, title, body, isActive: true } });
    }
  }
}

async function seedDemoChannelData(tenantId: string) {
  const channelDemos: Array<{ channel: ChannelType; externalId: string; state: string; handoff: boolean }> = [
    { channel: ChannelType.WEB_CHAT, externalId: 'web-demo-1', state: 'TICKET_CREATED', handoff: false },
    { channel: ChannelType.WEB_CHAT, externalId: 'web-demo-2', state: 'OPEN', handoff: false },
    { channel: ChannelType.WHATSAPP, externalId: 'wa-demo-90555111', state: 'TICKET_CREATED', handoff: false },
    { channel: ChannelType.WHATSAPP, externalId: 'wa-demo-90555222', state: 'OPEN', handoff: true },
    { channel: ChannelType.INSTAGRAM, externalId: 'ig-demo-001', state: 'OPEN', handoff: false },
    { channel: ChannelType.FACEBOOK, externalId: 'fb-demo-001', state: 'OPEN', handoff: true },
    { channel: ChannelType.SMS, externalId: 'sms-demo-001', state: 'TICKET_CREATED', handoff: false },
  ];

  for (const demo of channelDemos) {
    const existing = await prisma.conversation.findFirst({
      where: { tenantId, channel: demo.channel, externalConversationId: demo.externalId },
    });
    if (existing) continue;
    await prisma.conversation.create({
      data: {
        tenantId,
        channel: demo.channel,
        externalConversationId: demo.externalId,
        state: demo.state,
        handoffRequested: demo.handoff,
        context: {
          messages: [
            { role: 'citizen', text: `${demo.channel} demo mesaji`, at: new Date().toISOString() },
            { role: 'assistant', text: 'Demo asistan cevabi.', at: new Date().toISOString() },
          ],
        },
        lastMessageAt: new Date(),
      },
    });

    await prisma.channelEvent.create({
      data: {
        tenantId,
        channel: demo.channel,
        provider: demo.channel.toLowerCase(),
        externalEventId: `${demo.externalId}-evt-1`,
        payload: { direction: 'INBOUND', text: 'Demo seed event', externalConversationId: demo.externalId },
        processedAt: new Date(),
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).process?.exit(1);
    throw error;
  });
