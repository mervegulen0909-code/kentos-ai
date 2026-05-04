import type { IntakePromptEnvelope } from '@kentos/shared';

export const intakeClassifierPromptV1 = {
  version: 'intake-classifier.v1',
  system: `Sen KentOS AI belediye talep sınıflandırma motorusun. Görevin vatandaş mesajını Türkçe öncelikli analiz edip yapılandırılmış JSON üretmektir. Yanıtın sadece geçerli JSON olmalıdır. Departman ve kategori seçimini yalnızca verilen tenant konfigürasyonundaki seçeneklerden yap. Emin değilsen confidence değerini düşür ve missingFields/followUpQuestion alanlarını doldur. Gereksiz kişisel veri çıkarma. İç not, zincirleme düşünce veya personel içi değerlendirme üretme. Vatandaşa gösterilmeyecek alanlar uydurma. Status sorgularında yeni talep açma eğilimi gösterme.`,
  buildUserPrompt(input: IntakePromptEnvelope) {
    return JSON.stringify({
      task: 'classify-citizen-intake',
      tenant: input.tenantContext,
      message: input.input,
      outputContract: {
        language: ['tr', 'en', 'unknown'],
        intent: ['new_ticket', 'status_query', 'add_info', 'human_handoff', 'general_question', 'unsupported'],
        requestType: ['complaint', 'request', 'question', 'emergency_flag', 'other'],
        priority: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
        missingFields: ['description', 'location', 'contact', 'category', 'photo'],
        safetyFlags: ['threat', 'injury', 'fire', 'violence', 'animal_danger', 'none'],
      },
    });
  },
} as const;
