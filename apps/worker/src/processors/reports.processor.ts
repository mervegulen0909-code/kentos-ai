export async function processReportJob(job: { name: string; data: unknown }) {
  return { processor: 'reports', job: job.name, accepted: true };
}
