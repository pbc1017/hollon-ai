import { Module } from '@nestjs/common';
import { PromptComposerService } from './prompt-composer.service';
import { PromptComposerController } from './prompt-composer.controller';

@Module({
  controllers: [PromptComposerController],
  providers: [PromptComposerService],
  exports: [PromptComposerService],
})
export class PromptComposerModule {}
