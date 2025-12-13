import { Module } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [
    // TypeORM entities will be registered here
    // When entities are created, uncomment the following line:
    // TypeOrmModule.forFeature([]),
  ],
  controllers: [],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
