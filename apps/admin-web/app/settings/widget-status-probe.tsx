'use client';

import { useState, useTransition } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_PUBLIC_API_BASE_URL
  ?? process.env.NEXT_PUBLIC_API_BASE_URL
  ?? 'http://localhost:3100/api/v1';

type ProbeResult = {
  widgetEnabled: boolean;
  widgetReady: boolean;
  origin: string | null;
  originAllowed: boolean | null;
  allowedOriginCount: number;
  checkedAt: string;
};

type ProbeError = { message: string };

export function WidgetStatusProbe({ tenantSlug }: { tenantSlug: string }) {
  const [origin, setOrigin] = useState('');
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [error, setError] = useState<ProbeError | null>(null);
  const [pending, startTransition] = useTransition();

  function runProbe() {
    setError(null);
    startTransition(async () => {
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (origin.trim()) headers['x-probe-origin'] = origin.trim();
        const response = await fetch(`${API_BASE_URL}/public/${encodeURIComponent(tenantSlug)}/widget-status`, {
          headers,
          cache: 'no-store',
        });
        if (!response.ok) {
          setError({ message: `Probe basarisiz (${response.status})` });
          setResult(null);
          return;
        }
        const data = (await response.json()) as ProbeResult;
        setResult(data);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Bilinmeyen baglanti hatasi';
        setError({ message });
        setResult(null);
      }
    });
  }

  return (
    <div className="notice muted" role="note" style={{ marginTop: 12, display: 'grid', gap: 10 }}>
      <strong>Kurulum bağlantı testi</strong>
      <p>Widget endpoint'inin canlı olup olmadığını ve origin'in tenant allowlist'inde göründüğünü kontrol eder.</p>
      <label style={{ display: 'grid', gap: 6 }}>
        Test origin (opsiyonel)
        <input
          name="probeOrigin"
          placeholder="https://www.belediye.gov.tr"
          value={origin}
          onChange={(event) => setOrigin(event.target.value)}
          disabled={pending}
        />
      </label>
      <button type="button" onClick={runProbe} disabled={pending} style={{ justifySelf: 'flex-start' }}>
        {pending ? 'Test çalışıyor...' : 'Bağlantıyı test et'}
      </button>
      {result ? (
        <ul style={{ marginTop: 8, lineHeight: 1.7 }}>
          <li>Widget aktif: <strong>{result.widgetEnabled ? 'Evet' : 'Hayır'}</strong></li>
          <li>Widget hazır: <strong>{result.widgetReady ? 'Evet' : 'Hayır'}</strong></li>
          <li>Allowlist boyutu: <strong>{result.allowedOriginCount}</strong></li>
          {result.origin ? (
            <li>
              Test edilen origin <code>{result.origin}</code>: <strong>{result.originAllowed ? 'Allowlist içinde' : 'Allowlist dışı'}</strong>
            </li>
          ) : null}
          <li style={{ color: 'var(--muted)' }}>Sorgu: {new Date(result.checkedAt).toLocaleString('tr-TR')}</li>
        </ul>
      ) : null}
      {error ? <p role="alert" style={{ color: 'var(--danger)' }}>{error.message}</p> : null}
    </div>
  );
}
