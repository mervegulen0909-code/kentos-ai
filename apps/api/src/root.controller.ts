import { Controller, Get } from '@nestjs/common';

@Controller()
export class RootController {
  @Get()
  root() {
    return {
      status: 'ok',
      service: 'kentos-api',
      message: 'KentOS API calisiyor. Kullanici arayuzleri admin ve vatandas web uygulamalarindadir.',
      links: {
        admin: 'http://localhost:3101',
        citizen: 'http://localhost:3102',
        apiHealth: 'http://localhost:3100/api/v1/health',
        apiDocs: 'http://localhost:3100/api/docs',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
