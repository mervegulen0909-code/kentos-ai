export async function processSlaJob(job: { name: string; data: unknown }) {
  return { processor: 'sla', job: job.name, accepted: true };
}
