export async function processMediaJob(job: { name: string; data: unknown }) {
  return { processor: 'media', job: job.name, accepted: true };
}
