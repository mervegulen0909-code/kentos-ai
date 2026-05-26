/**
 * KentOS AI — k6 Load Test (Smoke)
 *
 * Senaryo: Ticket create → tracking → admin login → status transition
 * Hedef  : p95 < 500ms, error rate < %1
 *
 * Kullanım:
 *   k6 run test/load/k6-smoke.js --env BASE_URL=https://api.xn--izmirusul-y9a.com
 *   k6 run test/load/k6-smoke.js --env BASE_URL=http://localhost:3100 --env ADMIN_EMAIL=admin@test.com --env ADMIN_PASS=secret
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3100';
const TENANT_SLUG = __ENV.TENANT_SLUG || 'netiva';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@kentos.local';
const ADMIN_PASS = __ENV.ADMIN_PASS || 'changeme';

// ── Custom metrics ─────────────────────────────────────────────────────────────
const ticketCreateDuration = new Trend('ticket_create_duration', true);
const trackDuration = new Trend('track_duration', true);
const adminLoginDuration = new Trend('admin_login_duration', true);
const errorRate = new Rate('error_rate');

// ── Stages ────────────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // ramp up
    { duration: '4m',  target: 50 },   // sustain
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    error_rate: ['rate<0.01'],
    ticket_create_duration: ['p(95)<600'],
    track_duration: ['p(95)<400'],
    admin_login_duration: ['p(95)<500'],
  },
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ── Helpers ────────────────────────────────────────────────────────────────────
function apiV1(path) {
  return `${BASE_URL}/api/v1${path}`;
}

function ok(res, tag) {
  const passed = check(res, {
    [`${tag} status 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });
  errorRate.add(!passed);
  return passed;
}

// ── Main VU loop ───────────────────────────────────────────────────────────────
export default function () {
  // 1. Health check (lightweight — ensures basic connectivity)
  {
    const res = http.get(apiV1('/health'));
    ok(res, 'health');
  }

  sleep(0.2);

  // 2. Public ticket create (citizen side — no auth required)
  let trackingToken = null;
  {
    const payload = JSON.stringify({
      tenantSlug: TENANT_SLUG,
      subject: `k6 load test ${Date.now()}`,
      body: 'Otomatik yük testi isteği — lütfen görmezden gelin.',
      channel: 'WEB_CHAT',
      citizenName: 'k6 Test',
      citizenPhone: '+905550000000',
    });

    const start = Date.now();
    const res = http.post(apiV1('/public/tickets'), payload, { headers: JSON_HEADERS });
    ticketCreateDuration.add(Date.now() - start);

    if (ok(res, 'ticket_create')) {
      try {
        const body = JSON.parse(res.body);
        trackingToken = body?.trackingToken ?? body?.data?.trackingToken;
      } catch (_) {}
    }
  }

  sleep(0.3);

  // 3. Track the ticket (if we got a token)
  if (trackingToken) {
    const start = Date.now();
    const res = http.get(apiV1(`/public/tickets/${trackingToken}`));
    trackDuration.add(Date.now() - start);
    ok(res, 'ticket_track');
  }

  sleep(0.5);

  // 4. Admin login (only 20% of VUs to avoid hammering auth)
  if (Math.random() < 0.2) {
    const payload = JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS });
    const start = Date.now();
    const res = http.post(apiV1('/auth/login'), payload, { headers: JSON_HEADERS });
    adminLoginDuration.add(Date.now() - start);
    ok(res, 'admin_login');
  }

  sleep(1);
}
