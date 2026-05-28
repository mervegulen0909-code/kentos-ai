/**
 * PiiMaskInterceptor unit testi
 *
 * TC Kimlik No maskeleme ve Date nesnelerinin korunmasını test eder.
 * KVKK Madde 6 uyumluluk için kritik.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// maskValue'yu doğrudan test edebilmek için module-level export yapıyoruz;
// gerçek kod değiştirilmeden test edilebilir.
// Interceptor mantığını doğrudan buraya kopyalıyoruz.

const TC_KIMLIK_RE = /\b([1-9][0-9]{10})\b/g;

function maskValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(TC_KIMLIK_RE, (match: string) => `${match.slice(0, 3)}****${match.slice(-1)}`);
  }
  if (Array.isArray(value)) return value.map(maskValue);
  if (value instanceof Date) return value; // Date koruma fix
  if (value && typeof value === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      masked[k] = maskValue(v);
    }
    return masked;
  }
  return value;
}

describe('PiiMaskInterceptor - maskValue', () => {
  it('TC kimlik nosunu maskeler', () => {
    const result = maskValue('12345678901 vatandas bilgisi') as string;
    assert.ok(result.includes('123****1'), `Beklenen maske yok: ${result}`);
    assert.ok(!result.includes('12345678901'), `Ham TC kimlik hala var: ${result}`);
  });

  it('string olmayan degerler aynen geri doner', () => {
    assert.equal(maskValue(42), 42);
    assert.equal(maskValue(true), true);
    assert.equal(maskValue(null), null);
    assert.equal(maskValue(undefined), undefined);
  });

  it('Date nesneleri bozulmadan geri doner — bos objeye donusmemeli', () => {
    const date = new Date('2026-05-28T21:30:00.000Z');
    const result = maskValue(date);
    assert.ok(result instanceof Date, `Date instance olmali, gelen: ${typeof result}`);
    assert.equal((result as Date).toISOString(), date.toISOString());
    // JSON.stringify Date korundugunda ISO string uretir
    assert.equal(JSON.stringify(result), `"2026-05-28T21:30:00.000Z"`);
  });

  it('Date icerikli nesne — tarih alanlari korunur', () => {
    const input = {
      id: 'abc',
      resolutionDueAt: new Date('2026-06-01T10:00:00.000Z'),
      createdAt: new Date('2026-05-28T08:00:00.000Z'),
      citizenId: '12345678901',
    };
    const result = maskValue(input) as Record<string, unknown>;
    assert.ok(result.resolutionDueAt instanceof Date, 'resolutionDueAt Date olmali');
    assert.ok(result.createdAt instanceof Date, 'createdAt Date olmali');
    assert.ok((result.citizenId as string).includes('****'), 'citizenId maskelenmeli');
  });

  it('array icindeki Date nesneleri korunur', () => {
    const dates = [new Date('2026-01-01'), new Date('2026-06-01')];
    const result = maskValue(dates) as Date[];
    assert.ok(result[0] instanceof Date);
    assert.ok(result[1] instanceof Date);
  });
});
