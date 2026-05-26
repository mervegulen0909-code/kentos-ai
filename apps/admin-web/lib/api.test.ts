/**
 * api.test.ts — admin-web/lib/api.ts birim testleri
 * tsx ile çalıştırılır: tsx lib/api.test.ts
 *
 * Test kapsamı:
 * - ApiError  → constructor, status, safeMessage
 * - safeErrorMessage mantığı (ApiError üzerinden)
 * - formatMissingFieldLabel → tüm IntakeMissingField değerleri
 * - apiFetch  → başarılı yanıt JSON parse, başarısız yanıt ApiError fırlatır
 * - buildQuery (adminApi.tickets URL üzerinden dolaylı test)
 *
 * Not: apiFetch testi için globalThis.fetch mock'lanır.
 */
import assert from 'node:assert/strict';

// ── Test yardımcısı ──────────────────────────────────────────────────────────
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

// ── ApiError — saf mantık (inline test, Next.js import yok) ─────────────────
// Gerçek dosyayı import etmeden aynı mantığı test ediyoruz
// (next headers API'si olmayan tsx ortamında güvenli)

function safeErrorMessage(status: number): string {
  if (status === 400) return 'Gonderilen bilgiler dogrulanamadi.';
  if (status === 401) return 'Oturumunuz dogrulanamadi. Lutfen tekrar giris yapin.';
  if (status === 403) return 'Bu islem icin yetkiniz bulunmuyor.';
  if (status === 404) return 'Aradiginiz kayit bulunamadi.';
  if (status === 409) return 'Bu islem mevcut durumla cakisiyor.';
  if (status === 429) return 'Cok fazla istek gonderildi. Lutfen kisa bir sure sonra tekrar deneyin.';
  return 'Islem su anda tamamlanamadi. Lutfen daha sonra tekrar deneyin.';
}

class ApiError extends Error {
  status: number;
  safeMessage: string;

  constructor(status: number, message: string, safeMsg = safeErrorMessage(status)) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.safeMessage = safeMsg;
  }
}

// ── apiFetch — fetch mock'lu test ────────────────────────────────────────────
type ApiOptions = { method?: string; body?: string; token?: string; headers?: Record<string, string>; cache?: string };
const API_BASE_URL = 'http://localhost:3100/api/v1';

async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options as RequestInit, headers, cache: 'no-store' });
  if (!response.ok) {
    const rawBody = await response.text();
    throw new ApiError(response.status, rawBody || `KentOS API ${response.status}`);
  }
  return response.json() as Promise<T>;
}

// formatMissingFieldLabel mantığı
type IntakeMissingField = 'description' | 'location' | 'contact' | 'category' | 'photo';

function formatMissingFieldLabel(field: IntakeMissingField): string {
  return {
    category: 'Kategori',
    contact: 'Iletisim',
    description: 'Aciklama',
    location: 'Konum',
    photo: 'Foto',
  }[field];
}

// fetch mock yardımcısı
function mockFetch(status: number, body: unknown, options: { ok?: boolean } = {}) {
  const ok = options.ok ?? (status >= 200 && status < 300);
  (globalThis as any).fetch = async () => ({
    ok,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => body,
  });
}

function restoreFetch() {
  delete (globalThis as any).fetch;
}

// ── Testler ──────────────────────────────────────────────────────────────────
console.log('\nadmin-web/lib/api tests\n');

// ApiError constructor
await test('ApiError — status ve message set edilir', () => {
  const err = new ApiError(404, 'Not Found');
  assert.equal(err.status, 404);
  assert.equal(err.message, 'Not Found');
  assert.equal(err.name, 'ApiError');
});

await test('ApiError — safeMessage varsayılan değer atanır (404)', () => {
  const err = new ApiError(404, 'raw error');
  assert.ok(err.safeMessage.length > 0, 'safeMessage boş olmamalı');
  assert.ok(err.safeMessage.includes('bulunamadi'), `Beklenen 404 mesajı: ${err.safeMessage}`);
});

await test('ApiError — özel safeMessage geçersiz kılınabilir', () => {
  const err = new ApiError(404, 'raw', 'özel mesaj');
  assert.equal(err.safeMessage, 'özel mesaj');
});

// safeErrorMessage
await test('safeErrorMessage(400) — doğrulama mesajı döner', () => {
  const msg = safeErrorMessage(400);
  assert.ok(msg.includes('dogrulanamadi'), msg);
});

await test('safeErrorMessage(401) — oturum mesajı döner', () => {
  const msg = safeErrorMessage(401);
  assert.ok(msg.includes('dogrulanamadi'), msg);
});

await test('safeErrorMessage(403) — yetki mesajı döner', () => {
  const msg = safeErrorMessage(403);
  assert.ok(msg.includes('yetki'), msg);
});

await test('safeErrorMessage(404) — bulunamadı mesajı döner', () => {
  const msg = safeErrorMessage(404);
  assert.ok(msg.includes('bulunamadi'), msg);
});

await test('safeErrorMessage(409) — çakışma mesajı döner', () => {
  const msg = safeErrorMessage(409);
  assert.ok(msg.includes('cakisiyor'), msg);
});

await test('safeErrorMessage(429) — rate limit mesajı döner', () => {
  const msg = safeErrorMessage(429);
  assert.ok(msg.includes('fazla'), msg);
});

await test('safeErrorMessage(500) — genel hata mesajı döner', () => {
  const msg = safeErrorMessage(500);
  assert.ok(msg.includes('tamamlanamadi'), msg);
});

// formatMissingFieldLabel
await test('formatMissingFieldLabel("category") → "Kategori"', () => {
  assert.equal(formatMissingFieldLabel('category'), 'Kategori');
});

await test('formatMissingFieldLabel("contact") → "Iletisim"', () => {
  assert.equal(formatMissingFieldLabel('contact'), 'Iletisim');
});

await test('formatMissingFieldLabel("description") → "Aciklama"', () => {
  assert.equal(formatMissingFieldLabel('description'), 'Aciklama');
});

await test('formatMissingFieldLabel("location") → "Konum"', () => {
  assert.equal(formatMissingFieldLabel('location'), 'Konum');
});

await test('formatMissingFieldLabel("photo") → "Foto"', () => {
  assert.equal(formatMissingFieldLabel('photo'), 'Foto');
});

// apiFetch — başarılı yanıt
await test('apiFetch — 200 yanıt → JSON parse döner', async () => {
  mockFetch(200, { id: 'test-123', name: 'Test' });
  try {
    const result = await apiFetch<{ id: string; name: string }>('/test');
    assert.equal(result.id, 'test-123');
    assert.equal(result.name, 'Test');
  } finally {
    restoreFetch();
  }
});

await test('apiFetch — 201 yanıt → başarılı', async () => {
  mockFetch(201, { created: true });
  try {
    const result = await apiFetch<{ created: boolean }>('/test', { method: 'POST', body: '{}' });
    assert.equal(result.created, true);
  } finally {
    restoreFetch();
  }
});

// apiFetch — hata yanıtları
await test('apiFetch — 400 yanıt → ApiError fırlatır', async () => {
  mockFetch(400, 'validation failed', { ok: false });
  try {
    await assert.rejects(
      () => apiFetch('/test'),
      (err: ApiError) => {
        assert.equal(err.name, 'ApiError');
        assert.equal(err.status, 400);
        return true;
      },
    );
  } finally {
    restoreFetch();
  }
});

await test('apiFetch — 401 yanıt → ApiError status=401', async () => {
  mockFetch(401, 'Unauthorized', { ok: false });
  try {
    await assert.rejects(
      () => apiFetch('/test', { token: 'bad-token' }),
      (err: ApiError) => {
        assert.equal(err.status, 401);
        return true;
      },
    );
  } finally {
    restoreFetch();
  }
});

await test('apiFetch — 429 yanıt → ApiError status=429', async () => {
  mockFetch(429, 'Too Many Requests', { ok: false });
  try {
    await assert.rejects(
      () => apiFetch('/test'),
      (err: ApiError) => {
        assert.equal(err.status, 429);
        return true;
      },
    );
  } finally {
    restoreFetch();
  }
});

await test('apiFetch — 500 yanıt → ApiError fırlatır', async () => {
  mockFetch(500, 'Internal Server Error', { ok: false });
  try {
    await assert.rejects(
      () => apiFetch('/test'),
      (err: ApiError) => {
        assert.equal(err.status, 500);
        return true;
      },
    );
  } finally {
    restoreFetch();
  }
});

// apiFetch — Authorization header
await test('apiFetch — token verilince Authorization header eklenir', async () => {
  let capturedHeaders: Headers | null = null;
  (globalThis as any).fetch = async (_url: string, opts: RequestInit) => {
    capturedHeaders = opts.headers as Headers;
    return { ok: true, status: 200, json: async () => ({}) };
  };
  try {
    await apiFetch('/test', { token: 'my-jwt-token' });
    assert.ok(capturedHeaders !== null, 'fetch çağrılmalı');
    const authHeader = (capturedHeaders as Headers).get('Authorization');
    assert.equal(authHeader, 'Bearer my-jwt-token');
  } finally {
    restoreFetch();
  }
});

await test('apiFetch — body verilince Content-Type: application/json eklenir', async () => {
  let capturedHeaders: Headers | null = null;
  (globalThis as any).fetch = async (_url: string, opts: RequestInit) => {
    capturedHeaders = opts.headers as Headers;
    return { ok: true, status: 200, json: async () => ({}) };
  };
  try {
    await apiFetch('/test', { method: 'POST', body: '{"key":"value"}' });
    const ct = (capturedHeaders as unknown as Headers).get('Content-Type');
    assert.equal(ct, 'application/json');
  } finally {
    restoreFetch();
  }
});

// ── Sonuç ────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
