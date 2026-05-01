export async function processNotificationJob(job: { name: string; data: unknown }) {
  return { processor: 'notifications', job: job.name, externalSend: false };
}
