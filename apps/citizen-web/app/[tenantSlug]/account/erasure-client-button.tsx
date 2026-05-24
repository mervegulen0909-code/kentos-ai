'use client';

import { useState } from 'react';

export function ErasureClientButton({ tenantSlug }: { tenantSlug: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleErase() {
    if (!confirm(
      'Kişisel verileriniz kalıcı olarak silinecek. Bu işlem geri alınamaz. Onaylıyor musunuz?'
    )) return;

    setState('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`/${tenantSlug}/account/erasure`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Silme başarısız.');
      }
      setState('done');
      setTimeout(() => { window.location.href = `/${tenantSlug}/report`; }, 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Bir hata oluştu.');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div className="notice" role="status" style={{ background: 'var(--success, #16a34a)', color: '#fff' }}>
        <strong>Verileriniz başarıyla silindi.</strong> Yönlendiriliyorsunuz…
      </div>
    );
  }

  return (
    <>
      {state === 'error' && errorMsg && (
        <div className="notice error" role="alert" style={{ marginBottom: '1rem' }}>
          <strong>{errorMsg}</strong>
        </div>
      )}
      <button
        type="button"
        className="cta"
        style={{ background: 'var(--error, #dc2626)', color: '#fff', border: 'none', cursor: 'pointer' }}
        onClick={handleErase}
        disabled={state === 'loading'}
      >
        {state === 'loading' ? 'Siliniyor…' : 'Verilerimi Kalıcı Olarak Sil'}
      </button>
    </>
  );
}
