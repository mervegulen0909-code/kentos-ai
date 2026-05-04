import { PublicTicketAiRunnerService } from './main.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const runner = new PublicTicketAiRunnerService();

const tenantContext = {
  tenantId: 'demo-tenant-id',
  tenantSlug: 'demo-belediye',
  departments: [
    { id: 'dep-fen', code: 'FEN', name: 'Fen İşleri' },
    { id: 'dep-zabita', code: 'ZABITA', name: 'Zabıta' },
  ],
  categories: [
    { id: 'cat-road', code: 'YOL_BAKIM', name: 'Yol Bakım', departmentId: 'dep-fen' },
    { id: 'cat-clean', code: 'TEMIZLIK', name: 'Temizlik', departmentId: 'dep-zabita' },
  ],
};

async function testClassifiesNewCitizenTicket() {
  const result = await runner.classify({
    tenantContext,
    message: {
      text: 'Atatürk Mahallesi 12. Sokak yanında çukur oluştu, araçlar için tehlike yaratıyor.',
      channel: 'CITIZEN_WEB',
      receivedAt: '2026-05-03T12:00:00.000Z',
      citizenContact: { phone: '+905551112233', displayName: 'Demo Vatandaş' },
    },
  });

  assert(result.promptVersion === 'intake-classifier.v1', 'prompt version should be preserved');
  assert(result.classification.intent === 'new_ticket', 'new issue text should classify as a new ticket');
  assert(result.classification.statusTicketNo === null, 'new ticket classification should not expose a status token');
  assert(!result.classification.missingFields.includes('contact'), 'phone contact should satisfy contact requirement');
}

async function testStatusQueryRequiresTkOnlyToken() {
  const result = await runner.classify({
    tenantContext,
    message: {
      text: 'TK-AB12CD34EF56AB78 takip kodlu başvurumun durumunu öğrenmek istiyorum.',
      channel: 'CITIZEN_WEB',
      receivedAt: '2026-05-03T12:00:00.000Z',
    },
  });

  assert(result.classification.intent === 'status_query', 'tracking text should classify as status query');
  assert(result.classification.statusTicketNo === 'TK-AB12CD34EF56AB78', 'status query should preserve canonical TK token');
}

await testClassifiesNewCitizenTicket();
await testStatusQueryRequiresTkOnlyToken();

console.log('ai service intake tests passed');
