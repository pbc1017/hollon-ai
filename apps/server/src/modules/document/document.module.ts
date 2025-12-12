import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { DocumentService } from './document.service';
import { KnowledgeRepository } from './repositories/knowledge.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  providers: [DocumentService, KnowledgeRepository],
  exports: [DocumentService, KnowledgeRepository],
})
export class DocumentModule {}
