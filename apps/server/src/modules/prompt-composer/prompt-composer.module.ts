import { Module } from '@nestjs/common';
import { PromptComposerService } from './prompt-composer.service';

@Module({
  providers: [PromptComposerService],
  exports: [PromptComposerService],
})
export class PromptComposerModule {}
