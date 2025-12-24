import { Injectable } from '@nestjs/common';

@Injectable()
export class PromptComposerService {
  async composePrompt(context: Record<string, any>): Promise<string> {
    // Placeholder implementation for prompt composition
    const sections: string[] = [];

    if (context.systemContext) {
      sections.push(`System Context: ${context.systemContext}`);
    }

    if (context.userInput) {
      sections.push(`User Input: ${context.userInput}`);
    }

    if (context.knowledgeContext) {
      sections.push(`Knowledge Context: ${context.knowledgeContext}`);
    }

    return sections.join('\n\n');
  }

  async templatePrompt(
    template: string,
    variables: Record<string, any>,
  ): Promise<string> {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return result;
  }

  async enrichWithContext(
    basePrompt: string,
    contextData: Record<string, any>,
  ): Promise<string> {
    const contextString = Object.entries(contextData)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');

    return `${basePrompt}\n\nAdditional Context:\n${contextString}`;
  }
}
