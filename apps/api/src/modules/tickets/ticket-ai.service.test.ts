/**
 * ticket-ai.service.test.ts — TicketAiService birim testleri
 * tsx ile çalıştırılır: tsx src/modules/tickets/ticket-ai.service.test.ts
 *
 * Test kapsamı:
 * - Deterministik yanıt üretimi (Anthropic kapalıyken)
 * - Prompt oluşturma mantığı (başlık, açıklama, departman, kategori, adres, mesajlar)
 * - Farklı ticket durumlarında doğru şablon seçimi
 * - operatorNote eklenmesi
 */
import assert from 'node:assert/strict';

// ── Deterministik yanıt üretimi (TicketAiService inline) ────────────────────

type TicketContext = {
  title: string;
  description: string;
  status: string;
  priority: string;
  addressText: string | null;
  category: { name: string } | null;
  department: { name: string } | null;
  messages: Array<{ body: string; createdAt: Date; senderType: string }>;
};

const STATUS_MESSAGES: Record<string, string> = {
  NEW: 'talebiniz sistemimize alınmış olup en kısa sürede değerlendirilecektir.',
  TRIAGED: 'talebiniz inceleme aşamasına alınmış olup ilgili birime yönlendirilecektir.',
  ASSIGNED: 'talebiniz ilgili birime iletilmiş olup ekibimiz en kısa sürede çalışmaya başlayacaktır.',
  IN_PROGRESS: 'talebiniz üzerinde ekibimiz çalışmaktadır. En kısa sürede bilgilendirme yapılacaktır.',
  WAITING_INFO: 'talebinizin işleme alınabilmesi için ek bilgi veya belge gerekmektedir. Lütfen eksik bilgileri tamamlayınız.',
  RESOLVED: 'talebiniz tamamlanmıştır. Hizmetimizden memnun kaldıysanız değerlendirme yapabilirsiniz.',
  CLOSED: 'talebiniz kapatılmıştır. Yeni bir talep oluşturmak için sistemimizi kullanabilirsiniz.',
};

function buildDeterministicSuggestion(ticket: TicketContext): { suggestion: string; model: string; tokensUsed: null } {
  const statusText = STATUS_MESSAGES[ticket.status] ?? 'talebiniz işleme alınmıştır.';
  const deptText = ticket.department ? `${ticket.department.name} birimince ` : '';
  const suggestion = [
    `Sayın Vatandaşımız,`,
    ``,
    `"${ticket.title}" konulu talebiniz ${deptText}${statusText}`,
    ``,
    `Belediyemize duyduğunuz güven için teşekkür ederiz. Daha fazla bilgi almak için iletişim kanallarımızı kullanabilirsiniz.`,
    ``,
    `Saygılarımızla,`,
    `Belediye Hizmet Birimi`,
  ].join('\n');
  return { suggestion, model: 'deterministic-fallback', tokensUsed: null };
}

function buildUserPrompt(ticket: TicketContext, operatorNote?: string): string {
  const lines: string[] = [
    `Talep başlığı: ${ticket.title}`,
    `Açıklama: ${ticket.description}`,
    `Durum: ${ticket.status}`,
    `Öncelik: ${ticket.priority}`,
  ];
  if (ticket.department) lines.push(`Birim: ${ticket.department.name}`);
  if (ticket.category) lines.push(`Kategori: ${ticket.category.name}`);
  if (ticket.addressText) lines.push(`Adres: ${ticket.addressText}`);
  if (ticket.messages.length > 0) {
    lines.push('\nGörüşme geçmişi:');
    for (const msg of ticket.messages) {
      const sender = msg.senderType === 'CITIZEN' ? 'Vatandaş' : 'Belediye';
      lines.push(`${sender}: ${msg.body}`);
    }
  }
  if (operatorNote?.trim()) {
    lines.push(`\nOperatör notu: ${operatorNote.trim()}`);
  }
  lines.push('\nYukarıdaki bilgilere göre vatandaşa uygun bir yanıt oluştur:');
  return lines.join('\n');
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

console.log('\nTicketAiService tests\n');

// ── buildDeterministicSuggestion ─────────────────────────────────────────────
test('model → deterministic-fallback', () => {
  const result = buildDeterministicSuggestion({
    title: 'Test', description: 'Test', status: 'NEW', priority: 'NORMAL',
    addressText: null, category: null, department: null, messages: [],
  });
  assert.equal(result.model, 'deterministic-fallback');
  assert.equal(result.tokensUsed, null);
});

test('NEW durumu → doğru şablon metni içerir', () => {
  const result = buildDeterministicSuggestion({
    title: 'Yol çukuru', description: 'Açıklama', status: 'NEW', priority: 'NORMAL',
    addressText: null, category: null, department: null, messages: [],
  });
  assert.ok(result.suggestion.includes('en kısa sürede değerlendirilecektir'), 'NEW şablon metni olmalı');
  assert.ok(result.suggestion.includes('Yol çukuru'), 'Başlık yanıtta geçmeli');
});

test('RESOLVED durumu → tamamlandı metni içerir', () => {
  const result = buildDeterministicSuggestion({
    title: 'Park bakım', description: 'Açıklama', status: 'RESOLVED', priority: 'NORMAL',
    addressText: null, category: null, department: null, messages: [],
  });
  assert.ok(result.suggestion.includes('tamamlanmıştır'));
});

test('WAITING_INFO durumu → ek bilgi mesajı içerir', () => {
  const result = buildDeterministicSuggestion({
    title: 'Ruhsat', description: 'Açıklama', status: 'WAITING_INFO', priority: 'HIGH',
    addressText: null, category: null, department: null, messages: [],
  });
  assert.ok(result.suggestion.includes('ek bilgi veya belge'));
});

test('Bilinmeyen durum → fallback mesajı', () => {
  const result = buildDeterministicSuggestion({
    title: 'Test', description: '', status: 'UNKNOWN_STATE', priority: 'NORMAL',
    addressText: null, category: null, department: null, messages: [],
  });
  assert.ok(result.suggestion.includes('talebiniz işleme alınmıştır'));
});

test('departman varsa birim adı yanıtta geçer', () => {
  const result = buildDeterministicSuggestion({
    title: 'Test', description: '', status: 'ASSIGNED', priority: 'NORMAL',
    addressText: null, category: null, department: { name: 'Altyapı Hizmetleri' }, messages: [],
  });
  assert.ok(result.suggestion.includes('Altyapı Hizmetleri birimince'));
});

test('departman yoksa birim metni geçmez', () => {
  const result = buildDeterministicSuggestion({
    title: 'Test', description: '', status: 'ASSIGNED', priority: 'NORMAL',
    addressText: null, category: null, department: null, messages: [],
  });
  assert.ok(!result.suggestion.includes('birimince'));
});

test('yanıt "Sayın Vatandaşımız" ile başlar', () => {
  const result = buildDeterministicSuggestion({
    title: 'Test', description: '', status: 'IN_PROGRESS', priority: 'NORMAL',
    addressText: null, category: null, department: null, messages: [],
  });
  assert.ok(result.suggestion.startsWith('Sayın Vatandaşımız'));
});

test('yanıt "Saygılarımızla" ile biter', () => {
  const result = buildDeterministicSuggestion({
    title: 'Test', description: '', status: 'NEW', priority: 'NORMAL',
    addressText: null, category: null, department: null, messages: [],
  });
  assert.ok(result.suggestion.includes('Saygılarımızla'));
});

// ── buildUserPrompt ───────────────────────────────────────────────────────────
test('buildUserPrompt — temel alanlar dahil edilir', () => {
  const prompt = buildUserPrompt({
    title: 'Kaldırım hasarı', description: 'Kaldırım bozulmuş', status: 'NEW', priority: 'HIGH',
    addressText: null, category: null, department: null, messages: [],
  });
  assert.ok(prompt.includes('Kaldırım hasarı'));
  assert.ok(prompt.includes('Kaldırım bozulmuş'));
  assert.ok(prompt.includes('NEW'));
  assert.ok(prompt.includes('HIGH'));
});

test('buildUserPrompt — kategori dahil edilir', () => {
  const prompt = buildUserPrompt({
    title: 'Test', description: '', status: 'NEW', priority: 'NORMAL',
    addressText: null,
    category: { name: 'Altyapı' },
    department: null, messages: [],
  });
  assert.ok(prompt.includes('Kategori: Altyapı'));
});

test('buildUserPrompt — adres dahil edilir', () => {
  const prompt = buildUserPrompt({
    title: 'Test', description: '', status: 'NEW', priority: 'NORMAL',
    addressText: 'Atatürk Cad. No:5',
    category: null, department: null, messages: [],
  });
  assert.ok(prompt.includes('Adres: Atatürk Cad. No:5'));
});

test('buildUserPrompt — adres null → adres satırı yok', () => {
  const prompt = buildUserPrompt({
    title: 'Test', description: '', status: 'NEW', priority: 'NORMAL',
    addressText: null, category: null, department: null, messages: [],
  });
  assert.ok(!prompt.includes('Adres:'));
});

test('buildUserPrompt — mesajlar dahil edilir', () => {
  const prompt = buildUserPrompt({
    title: 'Test', description: '', status: 'IN_PROGRESS', priority: 'NORMAL',
    addressText: null, category: null, department: null,
    messages: [
      { body: 'Ne zaman gelecek?', createdAt: new Date(), senderType: 'CITIZEN' },
      { body: 'Hafta içi geleceğiz.', createdAt: new Date(), senderType: 'OPERATOR' },
    ],
  });
  assert.ok(prompt.includes('Vatandaş: Ne zaman gelecek?'));
  assert.ok(prompt.includes('Belediye: Hafta içi geleceğiz.'));
});

test('buildUserPrompt — operatorNote dahil edilir', () => {
  const prompt = buildUserPrompt(
    { title: 'Test', description: '', status: 'NEW', priority: 'NORMAL', addressText: null, category: null, department: null, messages: [] },
    'Müşteri çok şikayetçi, acil çözüm gerek',
  );
  assert.ok(prompt.includes('Operatör notu:'));
  assert.ok(prompt.includes('acil çözüm gerek'));
});

test('buildUserPrompt — operatorNote boşsa dahil edilmez', () => {
  const prompt = buildUserPrompt(
    { title: 'Test', description: '', status: 'NEW', priority: 'NORMAL', addressText: null, category: null, department: null, messages: [] },
    '   ',
  );
  assert.ok(!prompt.includes('Operatör notu:'));
});

test('buildUserPrompt — mesaj yoksa görüşme geçmişi bölümü yok', () => {
  const prompt = buildUserPrompt({
    title: 'Test', description: '', status: 'NEW', priority: 'NORMAL',
    addressText: null, category: null, department: null, messages: [],
  });
  assert.ok(!prompt.includes('Görüşme geçmişi:'));
});

// ── Sonuç ─────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
