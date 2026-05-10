import type { MediaJobData } from '@kentos/shared';

export async function processMediaJob(job: { name: string; data: MediaJobData }) {
  return {
    processor: 'media',
    job: job.name,
    attachmentId: job.data.attachmentId,
    accepted: true,
    placeholder: 'checksum-confirmed',
  };
}
