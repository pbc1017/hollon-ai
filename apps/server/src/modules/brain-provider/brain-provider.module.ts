import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BrainProviderConfig } from './entities/brain-provider-config.entity';
import { CostRecord } from '../cost-tracking/entities/cost-record.entity';
import { BrainProviderController } from './brain-provider.controller';
import { BrainProviderService } from './brain-provider.service';
import { ProcessManagerService } from './services/process-manager.service';
import { CostCalculatorService } from './services/cost-calculator.service';
import { ResponseParserService } from './services/response-parser.service';
import { BrainProviderConfigService } from './services/brain-provider-config.service';
import { KnowledgeInjectionService } from './services/knowledge-injection.service';
import { KnowledgeExtractionService } from './services/knowledge-extraction.service';
import { ClaudeCodeProvider } from './providers/claude-code.provider';
import { DocumentModule } from '../document/document.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BrainProviderConfig, CostRecord]),
    ConfigModule,
    DocumentModule, // Phase 3.5: 지식 문서 접근
  ],
  controllers: [BrainProviderController],
  providers: [
    // Services
    ProcessManagerService,
    CostCalculatorService,
    ResponseParserService,
    BrainProviderConfigService,
    KnowledgeInjectionService, // Phase 3.5: 지식 주입
    KnowledgeExtractionService, // Knowledge extraction from tasks

    // Provider
    ClaudeCodeProvider,

    // Main service
    BrainProviderService,
  ],
  exports: [
    BrainProviderService,
    ClaudeCodeProvider,
    KnowledgeExtractionService,
  ],
})
export class BrainProviderModule {}
