import { getTrackRedirectPath, isLowercaseTrackingTokenVariant, isTrackingTokenFormat, normalizeTrackingToken } from './token';

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${String(expected)}\nReceived: ${String(actual)}`);
  }
}

function run() {
  assertEqual(normalizeTrackingToken(' tk-ab12cd34ef56ab78 '), 'TK-AB12CD34EF56AB78', 'normalizeTrackingToken should trim and uppercase input');
  assertEqual(isTrackingTokenFormat('TK-AB12CD34EF56AB78'), true, 'isTrackingTokenFormat should accept canonical tokens');
  assertEqual(isTrackingTokenFormat('AB12CD34EF56AB78'), false, 'isTrackingTokenFormat should reject missing TK prefix');
  assertEqual(isLowercaseTrackingTokenVariant('tk-ab12cd34ef56ab78'), true, 'isLowercaseTrackingTokenVariant should detect lowercase token variants');
  assertEqual(isLowercaseTrackingTokenVariant('TK-AB12CD34EF56AB78'), false, 'isLowercaseTrackingTokenVariant should ignore canonical tokens');
  assertEqual(getTrackRedirectPath('ankara', ''), '/ankara/track?error=missing', 'getTrackRedirectPath should handle missing tokens');
  assertEqual(getTrackRedirectPath('ankara', ' tk-ab12cd34ef56ab78 '), '/ankara/ticket/TK-AB12CD34EF56AB78', 'getTrackRedirectPath should normalize lowercase-but-valid tokens');
  assertEqual(getTrackRedirectPath('ankara', 'TK-123'), '/ankara/track?error=format', 'getTrackRedirectPath should reject malformed tokens');
  assertEqual(getTrackRedirectPath('ankara', 'KNT-2026-000001'), '/ankara/track?error=format', 'getTrackRedirectPath should reject legacy internal ticket numbers');
  console.log('track actions checks passed');
}

run();
