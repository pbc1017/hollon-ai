import { Controller } from '@nestjs/common';
import { PromptComposerService } from './prompt-composer.service';

@Controller('prompt-composer')
export class PromptComposerController {
  constructor(private readonly promptComposerService: PromptComposerService) {}

  // Endpoints to be implemented in future tasks
}
