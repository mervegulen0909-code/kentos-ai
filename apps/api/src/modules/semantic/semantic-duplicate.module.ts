import { Module } from '@nestjs/common';
import { SemanticDuplicateService } from './semantic-duplicate.service.js';

@Module({
  providers: [SemanticDuplicateService],
  exports: [SemanticDuplicateService],
})
export class SemanticDuplicateModule {}
