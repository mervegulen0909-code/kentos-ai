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
