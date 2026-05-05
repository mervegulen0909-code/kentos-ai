'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { submitWidgetMessage } from './actions';

type WidgetSubmitState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  trackingToken: string | null;
};

const initialWidgetSubmitState: WidgetSubmitState = {
  status: 'idle',
  message: null,
  trackingToken: null,
};

export function WidgetChatForm({ tenantSlug, trackHref }: { tenantSlug: string; trackHref: string }) {
  const [state, formAction, pending] = useActionState(submitWidgetMessage.bind(null, tenantSlug), initialWidgetSubmitState);

  return (
    <form action={formAction} className="widget-composer">
      <label htmlFor="widget-draft" className="widget-composer-label">
        Vatandaşın ilk mesajı
      </label>
      <textarea
        id="widget-draft"
        name="draft"
        rows={4}
        className="widget-composer-input"
        placeholder="Örn. Belediye binası yanındaki kaldırım taşları dağılmış, yaşlılar yürümekte zorlanıyor."
        defaultValue="Atatürk Mahallesi 12. Sokak'ta kaldırım çöktü, bebek arabası geçemiyor."
        required
      />
      <div className="widget-contact-grid">
        <label>
          Ad soyad
          <input name="displayName" autoComplete="name" placeholder="Ayşe Yılmaz" />
        </label>
        <label>
          Telefon veya e-posta
          <input name="contact" autoComplete="email tel" placeholder="05xx xxx xx xx veya e-posta" />
        </label>
      </div>
      {state.message ? (
        <div className={`widget-result widget-result-${state.status}`} role={state.status === 'error' ? 'alert' : 'status'}>
          <p>{state.message}</p>
          {state.trackingToken ? <strong>Takip kodu: {state.trackingToken}</strong> : null}
        </div>
      ) : null}
      <div className="widget-actions">
        <button className="cta" type="submit" disabled={pending}>
          {pending ? 'Talebiniz aktarılıyor' : 'Sohbetten başvuru aç'}
        </button>
        <Link className="widget-secondary-link" href={trackHref}>
          Takip kodu sorgula
        </Link>
      </div>
    </form>
  );
}
