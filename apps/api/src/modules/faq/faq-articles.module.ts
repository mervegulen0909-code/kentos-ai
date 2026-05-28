import { Module } from '@nestjs/common';
import { FaqArticlesController } from './faq-articles.controller.js';
import { FaqArticlesService } from './faq-articles.service.js';

@Module({
  controllers: [FaqArticlesController],
  providers: [FaqArticlesService],
  exports: [FaqArticlesService],
})
export class FaqArticlesModule {}
