import { citizenApi } from '../../../lib/api';
import { WidgetChatForm } from './widget-chat-form';

const suggestedMessages = [
  'Sokak lambasi yanmiyor, aksam cok karanlik oluyor.',
  'Cocuk parkindaki salincak kirik, kontrol edilmesi gerekiyor.',
  'Mazgal tikanmis olabilir, yagmurda su birikiyor.',
];

export default async function WidgetPreviewPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const __t0 = Date.now();
  console.warn(`[WIDGET-PAGE-TIMING] render start`);
  const { tenantSlug } = await params;
  const widgetSettings = await citizenApi.getWidgetSettings(tenantSlug).then((s) => {
    console.warn(`[WIDGET-PAGE-TIMING] getWidgetSettings OK: +${Date.now() - __t0}ms`);
    return s;
  }).catch(() => {
    console.warn(`[WIDGET-PAGE-TIMING] getWidgetSettings CATCH: +${Date.now() - __t0}ms`);
    return ({
    tenantSlug,
    widgetEnabled: true,
    widgetTitle: 'KentOS Belediye Asistani',
    widgetWelcome: 'Merhaba. Talebinizi kisa bir cumleyle yazin. Eksik bilgi varsa size bir takip sorusu sorarim, ardindan resmi basvuruya geceriz.',
    widgetAllowedOrigins: [],
    });
  });
  const trackHref = `/${tenantSlug}/track`;
  console.warn(`[WIDGET-PAGE-TIMING] render end (pre-return): +${Date.now() - __t0}ms`);
  console.warn(`[TS-PAGE] render end @${Date.now()}`);

  return (
    <main className="widget-preview-page">
      <section className="widget-preview-shell">
        <div className="widget-preview-header">
          <div>
            <p className="widget-preview-eyebrow">Gomulebilir belediye asistani - canli akis</p>
            <h1 className="widget-preview-title">{widgetSettings.widgetTitle}</h1>
          </div>
          <p className="widget-preview-copy">
            Bu ekran, belediye sitesine eklenecek widget akisini canli API uzerinden calistirir. Mesaj WEB_CHAT konusmasina yazilir;
            sonucuna gore takip kodu, eksik bilgi veya operator devri bilgisi ayni ekranda gorunur.
          </p>
        </div>

        <section className="widget-chat-card" aria-label="Widget sohbet akisi">
          <div className="widget-chat-toolbar">
            <div>
              <strong>KentOS Belediye Asistani</strong>
              <p>Vatandas talebini topla, AI intake ile siniflandir, ticket veya handoff akisini baslat.</p>
            </div>
            <span className="widget-status-pill">{widgetSettings.widgetEnabled ? 'Aktif' : 'Pasif'}</span>
          </div>

          <div className="widget-message-list">
            <div className="widget-message widget-message-assistant">
              {widgetSettings.widgetWelcome}
            </div>
            {suggestedMessages.map((message) => (
              <div key={message} className="widget-message widget-message-user">
                {message}
              </div>
            ))}
            <div className="widget-message widget-message-assistant">
              Asagidaki form gercek konusma kaydi olusturur. Tamamlanan talepler takip koduyla, eksik talepler takip sorusuyla,
              insan destegi gerekenler operator devri kuyruguyla devam eder.
            </div>
          </div>

          <WidgetChatForm tenantSlug={tenantSlug} trackHref={trackHref} />
        </section>
      </section>
    </main>
  );
}
