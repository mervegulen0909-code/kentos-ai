import { getPrismaClient } from '../prisma-client.js';

type GeocodeJobData = { ticketId: string; latitude: number; longitude: number };

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'KentOS-AI/1.0 (municipal-platform)';

async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lon}&format=jsonv2&addressdetails=1&accept-language=tr`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return null;
  const data = await res.json() as { display_name?: string };
  return data.display_name ?? null;
}

export async function processGeocodeJob(job: { name: string; data: GeocodeJobData }) {
  const prisma = getPrismaClient();
  const { ticketId, latitude, longitude } = job.data;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, addressText: true },
  });

  if (!ticket) return { processor: 'geocode', skipped: 'ticket_not_found' };
  if (ticket.addressText) return { processor: 'geocode', skipped: 'address_already_set' };

  const address = await reverseGeocode(latitude, longitude);
  if (!address) return { processor: 'geocode', skipped: 'nominatim_no_result' };

  await prisma.ticket.update({ where: { id: ticketId }, data: { addressText: address } });

  return { processor: 'geocode', ticketId, address };
}
