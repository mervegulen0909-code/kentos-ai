export async function processReportJob(job: { name: string; data: unknown }) {
  const generatedAt = new Date().toISOString();

  return {
    processor: 'reports',
    job: job.name,
    generatedAt,
    summary: 'report job accepted for local evidence collection',
    accepted: true,
  };
}
