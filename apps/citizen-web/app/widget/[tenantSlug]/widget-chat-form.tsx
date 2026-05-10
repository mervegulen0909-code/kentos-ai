'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { submitWidgetMessage } from './actions';

type WidgetSubmitState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  conversationId: string | null;
  trackingToken: string | null;
  handoffRequested: boolean;
  missingFields: string[];
};

const initialWidgetSubmitState: WidgetSubmitState = {
  status: 'idle',
  message: null,
  conversationId: null,
  trackingToken: null,
  handoffRequested: false,
  missingFields: [],
};

const missingFieldLabels: Record<string, string> = {
  category: 'Kategori',
  contact: 'Iletisim',
  description: 'Aciklama',
  location: 'Konum',
  photo: 'Foto',
};

export function WidgetChatForm({ tenantSlug, trackHref }: { tenantSlug: string; trackHref: string }) {
  const [state, formAction, pending] = useActionState(submitWidgetMessage.bind(null, tenantSlug), initialWidgetSubmitState);
  const trackingHref = state.trackingToken ? `/${tenantSlug}/ticket/${state.trackingToken}` : trackHref;

  return (
    <form action={formAction} className="widget-composer">
      <label htmlFor="widget-draft" className="widget-composer-label">
        Vatandasin ilk mesaji
      </label>
      <textarea
        id="widget-draft"
        name="draft"
        rows={4}
        className="widget-composer-input"
        placeholder="Orn. Belediye binasi yanindaki kaldirim taslari dagilmis, yaslilar yurumekte zorlaniyor."
        defaultValue="Ataturk Mahallesi 12. Sokak'ta kaldirim coktu, bebek arabasi gecemiyor."
        required
      />
      <div className="widget-contact-grid">
        <label>
          Ad soyad
          <input name="displayName" autoComplete="name" placeholder="Ayse Yilmaz" />
        </label>
        <label>
          Telefon veya e-posta
          <input name="contact" autoComplete="email tel" placeholder="05xx xxx xx xx veya e-posta" />
        </label>
      </div>
      <label>
        Foto veya belge
        <input name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" />
      </label>
      {state.message ? (
        <div className={`widget-result widget-result-${state.status}`} role={state.status === 'error' ? 'alert' : 'status'}>
          <p>{state.message}</p>
          {state.conversationId ? <small>Konusma kaydi: {state.conversationId}</small> : null}
          {state.handoffRequested ? <strong>Durum: Insan destegi talebi belediye ekibine iletildi.</strong> : null}
          {state.missingFields.length ? (
            <strong>Beklenen bilgiler: {state.missingFields.map((field) => missingFieldLabels[field] ?? field).join(', ')}</strong>
          ) : null}
          {state.trackingToken ? (
            <strong>
              Takip kodu: <Link href={trackingHref}>{state.trackingToken}</Link>
            </strong>
          ) : null}
        </div>
      ) : null}
      <div className="widget-actions">
        <button className="cta" type="submit" disabled={pending}>
          {pending ? 'Talebiniz aktariliyor' : 'Canli sohbet akisini baslat'}
        </button>
        <Link className="widget-secondary-link" href={trackingHref}>
          {state.trackingToken ? 'Olusan basvuruyu ac' : 'Takip kodu sorgula'}
        </Link>
      </div>
    </form>
  );
}
