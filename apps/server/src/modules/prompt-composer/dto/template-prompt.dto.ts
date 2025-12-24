import { IsString, IsObject, MaxLength } from 'class-validator';

export class TemplatePromptDto {
  @IsString()
  @MaxLength(10000)
  template: string;

  @IsObject()
  variables: Record<string, any>;
}
