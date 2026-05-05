export function normalizeTrackingToken(input: string) {
  return input.trim().toUpperCase();
}

export function isTrackingTokenFormat(input: string) {
  return /^TK-[A-F0-9]{16}$/.test(input);
}

export function isLowercaseTrackingTokenVariant(rawInput: string) {
  return rawInput !== rawInput.toUpperCase() && /^tk-[a-f0-9]{16}$/i.test(rawInput);
}

export function getTrackRedirectPath(tenantSlug: string, rawInput: string) {
  if (!rawInput.trim()) return `/${tenantSlug}/track?error=missing`;

  const trackingToken = normalizeTrackingToken(rawInput);
  if (!isTrackingTokenFormat(trackingToken)) {
    return `/${tenantSlug}/track?error=${isLowercaseTrackingTokenVariant(rawInput) ? 'lowercase' : 'format'}`;
  }

  return `/${tenantSlug}/ticket/${encodeURIComponent(trackingToken)}`;
}
