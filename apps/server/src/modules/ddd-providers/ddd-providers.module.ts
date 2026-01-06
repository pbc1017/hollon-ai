import { Global, Module } from '@nestjs/common';
import { HollonModule } from '../hollon/hollon.module';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { MessageModule } from '../message/message.module';
import { HollonService } from '../hollon/hollon.service';
import { CodeReviewService } from '../collaboration/services/code-review.service';
import { MessageService } from '../message/message.service';

/**
 * DDD Providers Module
 *
 * Global module that provides Port implementations (Service interface bindings)
 * This allows OrchestrationModule to inject services through interfaces
 * without direct module dependencies
 *
 * ✅ DDD Pattern: This module imports the actual service modules
 * and re-exports them as interface bindings
 */
@Global()
@Module({
  imports: [HollonModule, CollaborationModule, MessageModule],
  providers: [
    // Hollon Context
    {
      provide: 'IHollonService',
      useExisting: HollonService,
    },

    // Collaboration Context
    {
      provide: 'ICodeReviewService',
      useExisting: CodeReviewService,
    },

    // Communication Context
    {
      provide: 'IMessageService',
      useExisting: MessageService,
    },
  ],
  exports: ['IHollonService', 'ICodeReviewService', 'IMessageService'],
})
export class DddProvidersModule {}
