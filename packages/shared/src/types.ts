export type ChannelType = 'WHATSAPP' | 'WEB_CHAT' | 'CITIZEN_WEB' | 'MOBILE_APP' | 'OPERATOR';

export type TicketStatus =
  | 'NEW'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_INFO'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REJECTED';

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'TENANT_ADMIN'
  | 'MANAGER'
  | 'DEPARTMENT_STAFF'
  | 'OPERATOR'
  | 'READ_ONLY';

export type TenantContext = {
  tenantId: string;
  tenantSlug?: string;
};

export type NotificationJobData = {
  messageId: string;
};

export type IntakeChannel = 'WHATSAPP' | 'CITIZEN_WEB' | 'WEB_CHAT' | 'MOBILE_APP';

export type TenantOption = {
  id: string;
  code: string;
  name: string;
  departmentId?: string | null;
};

export type IntakeTenantConfig = {
  tenantId: string;
  tenantSlug: string;
  departments: TenantOption[];
  categories: TenantOption[];
};

export type IntakeCitizenContact = {
  phone?: string | null;
  email?: string | null;
  displayName?: string | null;
};

export type IntakeMessageInput = {
  text: string;
  channel: IntakeChannel;
  receivedAt: string;
  citizenContact?: IntakeCitizenContact;
};

export type IntakePromptEnvelope = {
  version: string;
  system: string;
  tenantContext: IntakeTenantConfig;
  input: IntakeMessageInput;
};

export type IntakeClassificationIntent =
  | 'new_ticket'
  | 'status_query'
  | 'add_info'
  | 'human_handoff'
  | 'general_question'
  | 'unsupported';

export type IntakeRequestType = 'complaint' | 'request' | 'question' | 'emergency_flag' | 'other';

export type IntakeMissingField = 'description' | 'location' | 'contact' | 'category' | 'photo';

export type IntakeSafetyFlag = 'threat' | 'injury' | 'fire' | 'violence' | 'animal_danger' | 'none';

export type TrackingToken = `TK-${string}`;

export type IntakeLanguage = 'tr' | 'en' | 'unknown';

export type IntakeLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
};

export type IntakeClassification = {
  language: IntakeLanguage;
  intent: IntakeClassificationIntent;
  title: string;
  description: string;
  requestType: IntakeRequestType;
  categoryCode: string | null;
  departmentCode: string | null;
  priority: TicketPriority;
  urgencyReason: string | null;
  addressText: string | null;
  neighborhoodName: string | null;
  location: IntakeLocation | null;
  citizenContact: {
    phone: string | null;
    email: string | null;
    displayName: string | null;
  };
  missingFields: IntakeMissingField[];
  followUpQuestion: string | null;
  statusTicketNo: TrackingToken | null;
  safetyFlags: IntakeSafetyFlag[];
  confidence: number;
  reasoningSummary: string;
};

export type PublicTicketAiIntakeRequest = {
  tenantContext: IntakeTenantConfig;
  message: IntakeMessageInput;
};

export type PublicTicketAiIntakeResult = {
  provider: 'stub';
  model: 'deterministic-fallback';
  promptVersion: string;
  classification: IntakeClassification;
  requestedAt: string;
  completedAt: string;
};
