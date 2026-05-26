export const queueNames = {
  sla: 'kentos.sla',
  notifications: 'kentos.notifications',
  media: 'kentos.media',
  retention: 'kentos.retention',
  outbound: 'kentos.outbound',
  webhooks: 'kentos.webhooks',
  csat: 'kentos.csat',
} as const;

export type QueueName = (typeof queueNames)[keyof typeof queueNames];
