import { PrismaClient, TicketPriority, UserRole } from '@prisma/client';
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
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
