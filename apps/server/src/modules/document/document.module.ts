import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { KnowledgeVersion } from './entities/knowledge-version.entity';
import { DocumentService } from './document.service';
import { KnowledgeVersionService } from './services/knowledge-version.service';
import { KnowledgeVersionController } from './controllers/knowledge-version.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Document, KnowledgeVersion])],
  controllers: [KnowledgeVersionController],
  providers: [DocumentService, KnowledgeVersionService],
  exports: [DocumentService, KnowledgeVersionService],
})
export class DocumentModule {}
