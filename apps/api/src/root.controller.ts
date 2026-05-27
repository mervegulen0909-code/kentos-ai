import { Controller, Get } from '@nestjs/common';

@Controller()
export class RootController {
  @Get()
  root() {
    const adminUrl = process.env.ADMIN_URL ?? 'http://localhost:3101';
    const citizenUrl = process.env.CITIZEN_URL ?? 'http://localhost:3102';
    const apiBase = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3100}`;
    return {
      status: 'ok',
      service: 'kentos-api',
      message: 'KentOS API calisiyor. Kullanici arayuzleri admin ve vatandas web uygulamalarindadir.',
      links: {
        admin: adminUrl,
        citizen: citizenUrl,
        apiHealth: `${apiBase}/api/v1/health`,
        apiDocs: `${apiBase}/api/docs`,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
