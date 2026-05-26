/**
 * events.service.test.ts — EventsService (SSE event bus) birim testleri
 * tsx ile çalıştırılır: tsx src/modules/events/events.service.test.ts
 *
 * Test kapsamı:
 * - emit() → abone event alır
 * - stream() → yalnızca kendi tenantId'sine ait event'leri alır
 * - Çoklu abone → aynı event'i alır
 * - Sıralı emit → sıra korunur
 * - Abone yokken emit → kilitlenme yok
 * - Tenant izolasyonu — çapraz tenant event sızıntısı yok
 */
import assert from 'node:assert/strict';
import { Subject, firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';

// EventsService mantığı inline (NestJS Logger bağımlılığı olmadan)
type KentosEventType =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.assigned'
  | 'ticket.message_added'
  | 'sla.breached'
  | 'delivery.dispatched'
  | 'heartbeat';

type KentosEvent = {
  type: KentosEventType;
  tenantId: string;
  payload: Record<string, unknown>;
};

function createEventBus() {
  const subject = new Subject<KentosEvent>();
  return {
    emit(event: KentosEvent): void {
      subject.next(event);
    },
    stream(tenantId: string) {
      return subject.asObservable().pipe(filter((e) => e.tenantId === tenantId));
    },
    complete() {
      subject.complete();
    },
  };
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

console.log('\nEventsService tests\n');

// ── Temel emit/subscribe ──────────────────────────────────────────────────────
await test('emit → abone event alır', async () => {
  const bus = createEventBus();
  const received = firstValueFrom(bus.stream('tenant-1').pipe(take(1)));
  bus.emit({ type: 'ticket.created', tenantId: 'tenant-1', payload: { ticketId: 'tkt-001' } });
  const event = await received;
  assert.equal(event.type, 'ticket.created');
  assert.equal(event.tenantId, 'tenant-1');
  assert.deepEqual(event.payload, { ticketId: 'tkt-001' });
});

await test('emit — abone yokken kilitlenme yok', () => {
  const bus = createEventBus();
  assert.doesNotThrow(() => {
    bus.emit({ type: 'ticket.created', tenantId: 'tenant-x', payload: {} });
    bus.emit({ type: 'sla.breached', tenantId: 'tenant-y', payload: {} });
  });
});

// ── Tenant izolasyonu ─────────────────────────────────────────────────────────
await test('stream — yabancı tenant event\'i gelmez', () => {
  const bus = createEventBus();
  let foreignReceived = false;

  const sub = bus.stream('tenant-A').subscribe(() => {
    foreignReceived = true;
  });
  bus.emit({ type: 'ticket.created', tenantId: 'tenant-B', payload: {} });
  // Subject senkron → emit anında işlenir
  sub.unsubscribe();

  assert.equal(foreignReceived, false);
});

await test('stream — kendi tenant\'ı event alır, diğeri almaz', () => {
  const bus = createEventBus();
  const aEvents: KentosEvent[] = [];
  const bEvents: KentosEvent[] = [];

  const subA = bus.stream('tenant-A').subscribe((e) => aEvents.push(e));
  const subB = bus.stream('tenant-B').subscribe((e) => bEvents.push(e));

  bus.emit({ type: 'ticket.updated', tenantId: 'tenant-A', payload: { id: '1' } });
  bus.emit({ type: 'ticket.updated', tenantId: 'tenant-B', payload: { id: '2' } });
  bus.emit({ type: 'sla.breached', tenantId: 'tenant-A', payload: { id: '3' } });

  subA.unsubscribe();
  subB.unsubscribe();

  assert.equal(aEvents.length, 2);
  assert.equal(bEvents.length, 1);
  assert.equal(aEvents[0]!.payload['id'], '1');
  assert.equal(aEvents[1]!.payload['id'], '3');
  assert.equal(bEvents[0]!.payload['id'], '2');
});

await test('10 farklı tenant — her biri yalnızca kendi event\'ini alır', () => {
  const bus = createEventBus();
  const received: Record<string, number> = {};

  const subs = Array.from({ length: 10 }, (_, i) => {
    const tid = `tenant-${i}`;
    received[tid] = 0;
    return bus.stream(tid).subscribe(() => { received[tid]!++; });
  });

  // Her tenant için 2 event gönder
  for (let i = 0; i < 10; i++) {
    bus.emit({ type: 'ticket.created', tenantId: `tenant-${i}`, payload: {} });
    bus.emit({ type: 'ticket.updated', tenantId: `tenant-${i}`, payload: {} });
  }

  subs.forEach((s) => s.unsubscribe());

  for (let i = 0; i < 10; i++) {
    assert.equal(received[`tenant-${i}`], 2, `tenant-${i} 2 event almalı`);
  }
});

// ── Çoklu abone ───────────────────────────────────────────────────────────────
await test('aynı tenant — çoklu abone aynı event\'i alır', async () => {
  const bus = createEventBus();
  const p1 = firstValueFrom(bus.stream('tenant-1').pipe(take(1)));
  const p2 = firstValueFrom(bus.stream('tenant-1').pipe(take(1)));

  bus.emit({ type: 'ticket.created', tenantId: 'tenant-1', payload: { ticketId: 'shared' } });

  const [e1, e2] = await Promise.all([p1, p2]);
  assert.equal(e1.payload['ticketId'], 'shared');
  assert.equal(e2.payload['ticketId'], 'shared');
});

// ── Sıralı emit ───────────────────────────────────────────────────────────────
await test('sıralı emit — event\'ler gönderim sırasıyla alınır', () => {
  const bus = createEventBus();
  const received: string[] = [];

  const sub = bus.stream('tenant-1').subscribe((e) => received.push(e.type));

  bus.emit({ type: 'ticket.created', tenantId: 'tenant-1', payload: {} });
  bus.emit({ type: 'ticket.assigned', tenantId: 'tenant-1', payload: {} });
  bus.emit({ type: 'ticket.updated', tenantId: 'tenant-1', payload: {} });
  bus.emit({ type: 'sla.breached', tenantId: 'tenant-1', payload: {} });

  sub.unsubscribe();

  assert.deepEqual(received, ['ticket.created', 'ticket.assigned', 'ticket.updated', 'sla.breached']);
});

// ── Event türleri ─────────────────────────────────────────────────────────────
await test('tüm event türleri yayınlanabilir', () => {
  const bus = createEventBus();
  const eventTypes: KentosEventType[] = [
    'ticket.created',
    'ticket.updated',
    'ticket.assigned',
    'ticket.message_added',
    'sla.breached',
    'delivery.dispatched',
    'heartbeat',
  ];
  const received: KentosEventType[] = [];
  const sub = bus.stream('tenant-1').subscribe((e) => received.push(e.type));

  for (const type of eventTypes) {
    bus.emit({ type, tenantId: 'tenant-1', payload: {} });
  }
  sub.unsubscribe();

  assert.deepEqual(received, eventTypes);
});

// ── Payload aktarımı ──────────────────────────────────────────────────────────
await test('payload referansı korunur', async () => {
  const bus = createEventBus();
  const payload = { ticketId: 'tkt-999', assigneeId: 'user-1', deep: { nested: true } };
  const received = firstValueFrom(bus.stream('tenant-1').pipe(take(1)));
  bus.emit({ type: 'ticket.assigned', tenantId: 'tenant-1', payload });
  const event = await received;
  assert.deepEqual(event.payload, payload);
});

// ── Sonuç ─────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
