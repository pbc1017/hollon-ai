import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { DocumentService } from './document.service';
import { DocumentQualityService } from './services/document-quality.service';

@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  providers: [DocumentService, DocumentQualityService],
  exports: [DocumentService, DocumentQualityService],
})
export class DocumentModule {}
