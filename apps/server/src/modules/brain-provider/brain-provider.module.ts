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
import { ClaudeCodeProvider } from './providers/claude-code.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([BrainProviderConfig, CostRecord]),
    ConfigModule,
  ],
  controllers: [BrainProviderController],
  providers: [
    // Services
    ProcessManagerService,
    CostCalculatorService,
    ResponseParserService,
    BrainProviderConfigService,

    // Provider
    ClaudeCodeProvider,

    // Main service
    BrainProviderService,
  ],
  exports: [BrainProviderService, ClaudeCodeProvider],
})
export class BrainProviderModule {}
