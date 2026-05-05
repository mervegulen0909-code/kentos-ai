import { citizenApi } from '../../../lib/api';
import { WidgetChatForm } from './widget-chat-form';

const suggestedMessages = [
  'Sokak lambası yanmıyor, akşam çok karanlık oluyor.',
  'Çocuk parkındaki salıncak kırık, kontrol edilmesi gerekiyor.',
  'Mazgal tıkanmış olabilir, yağmurda su birikiyor.',
];

export default async function WidgetPreviewPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const widgetSettings = await citizenApi.getWidgetSettings(tenantSlug).catch(() => ({
    tenantSlug,
    widgetEnabled: true,
    widgetTitle: 'KentOS Belediye Asistanı',
    widgetWelcome: 'Merhaba. Talebinizi kısa bir cümleyle yazın. Eksik bilgi varsa size bir takip sorusu sorarım, ardından resmi başvuruya geçeriz.',
    widgetAllowedOrigins: [],
  }));
  const trackHref = `/${tenantSlug}/track`;

  return (
    <main className="widget-preview-page">
      <section className="widget-preview-shell">
        <div className="widget-preview-header">
          <div>
            <p className="widget-preview-eyebrow">Gömülebilir belediye asistanı · Önizleme</p>
            <h1 className="widget-preview-title">{widgetSettings.widgetTitle}</h1>
          </div>
          <p className="widget-preview-copy">
            Bu ekran, belediye anasayfasına eklenecek sohbet kutusunun ilk kabuğunu temsil eder. Gerçek zamanlı konuşma yerine,
            kullanıcıyı resmi başvuru ve takip akışına yönlendirir.
          </p>
        </div>

        <section className="widget-chat-card" aria-label="Widget sohbet önizlemesi">
          <div className="widget-chat-toolbar">
            <div>
              <strong>KentOS Belediye Asistanı</strong>
              <p>Vatandaş talebini topla, gerekiyorsa resmi başvuruya taşı.</p>
            </div>
            <span className="widget-status-pill">Önizleme</span>
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
              İlk dalgada mesajınız güvenli şekilde WEB_CHAT kanalıyla mevcut başvuru omurgasına aktarılır. Takip kodunuz konuşma içinde gösterilir.
            </div>
          </div>

          <WidgetChatForm tenantSlug={tenantSlug} trackHref={trackHref} />
        </section>
      </section>
    </main>
  );
}
