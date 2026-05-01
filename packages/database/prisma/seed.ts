import { PrismaClient, TicketPriority, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const departments = [
  ['TEMIZLIK', 'Temizlik İşleri'],
  ['FEN_ISLERI', 'Fen İşleri'],
  ['PARK_BAHCELER', 'Park ve Bahçeler'],
  ['ZABITA', 'Zabıta'],
  ['SOSYAL_YARDIM', 'Sosyal Yardım'],
  ['KULTUR_SOSYAL', 'Kültür ve Sosyal İşler'],
  ['SU_KANALIZASYON', 'Su ve Kanalizasyon'],
  ['VETERINER', 'Veteriner İşleri'],
  ['ULASIM', 'Ulaşım'],
  ['RUHSAT_DENETIM', 'Ruhsat ve Denetim'],
  ['MALI_HIZMETLER', 'Mali Hizmetler'],
  ['BEYAZ_MASA', 'Beyaz Masa / Çağrı Merkezi'],
] as const;

const categories = [
  ['COP_TOPLAMA', 'Çöp toplama / konteyner', 'TEMIZLIK', TicketPriority.NORMAL],
  ['YOL_KALDIRIM', 'Yol, kaldırım ve asfalt', 'FEN_ISLERI', TicketPriority.HIGH],
  ['PARK_BAKIM', 'Park bakım ve oyun alanı', 'PARK_BAHCELER', TicketPriority.NORMAL],
  ['GURULTU_ISGAL', 'Gürültü, işgal ve denetim', 'ZABITA', TicketPriority.HIGH],
  ['SOKAK_HAYVANI', 'Sokak hayvanı ve veterinerlik', 'VETERINER', TicketPriority.NORMAL],
  ['SU_ARIZA', 'Su ve kanalizasyon arızası', 'SU_KANALIZASYON', TicketPriority.URGENT],
  ['TRAFIK_ULASIM', 'Trafik ve ulaşım', 'ULASIM', TicketPriority.HIGH],
  ['GENEL_BASVURU', 'Genel başvuru', 'BEYAZ_MASA', TicketPriority.NORMAL],
] as const;

const templates = [
  ['TICKET_RECEIVED', 'Talebiniz alınmıştır. Başvuru numaranız: {{ticketNo}}.'],
  ['TICKET_ROUTED', 'Talebiniz {{departmentName}} birimine aktarılmıştır. Başvuru numaranız: {{ticketNo}}.'],
  ['TICKET_IN_PROGRESS', '{{ticketNo}} numaralı talebiniz için işlem devam etmektedir.'],
  ['TICKET_RESOLVED', '{{ticketNo}} numaralı talebiniz çözümlenmiştir. Geri bildiriminiz bizim için değerlidir.'],
  ['INFO_REQUESTED', '{{ticketNo}} numaralı talebiniz için ek bilgiye ihtiyaç duyuyoruz: {{question}}'],
] as const;

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-belediye' },
    update: {},
    create: {
      name: 'Demo Belediyesi',
      slug: 'demo-belediye',
      timezone: 'Europe/Istanbul',
      locale: 'tr-TR',
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
    await prisma.messageTemplate.upsert({
      where: { tenantId_key_locale: { tenantId: tenant.id, key, locale: 'tr-TR' } },
      update: { body, isActive: true },
      create: { tenantId: tenant.id, key, locale: 'tr-TR', body },
    });
  }

  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo.local' } },
    update: { passwordHash, role: UserRole.TENANT_ADMIN, isActive: true },
    create: {
      tenantId: tenant.id,
      email: 'admin@demo.local',
      passwordHash,
      fullName: 'Demo Belediye Yöneticisi',
      role: UserRole.TENANT_ADMIN,
    },
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
