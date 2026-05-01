export const queueNames = {
  sla: 'kentos.sla',
  notifications: 'kentos.notifications',
  reports: 'kentos.reports',
  media: 'kentos.media',
} as const;

export type QueueName = (typeof queueNames)[keyof typeof queueNames];
