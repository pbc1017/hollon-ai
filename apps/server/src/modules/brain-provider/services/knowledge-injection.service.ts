import { Injectable, Logger } from '@nestjs/common';
import { DocumentService } from '../../document/document.service';
import { DocumentType } from '../../document/entities/document.entity';
import { Task } from '../../task/entities/task.entity';

export interface KnowledgeContext {
  task?: Task;
  organizationId: string;
  projectId?: string;
  requiredSkills?: string[];
  tags?: string[];
}

@Injectable()
export class KnowledgeInjectionService {
  private readonly logger = new Logger(KnowledgeInjectionService.name);

  constructor(private readonly documentService: DocumentService) {}

  /**
   * Phase 3.5: Task 실행 시 관련 지식을 프롬프트에 주입
   * SSOT 원칙: 조직 지식을 활용하여 누구나 Task 수행 가능
   *
   * @param basePrompt 기본 프롬프트
   * @param context 지식 컨텍스트 (Task, organizationId 등)
   * @returns 지식이 주입된 프롬프트
   */
  async injectKnowledge(
    basePrompt: string,
    context: KnowledgeContext,
  ): Promise<string> {
    try {
      // 1. Task에서 스킬 및 태그 추출
      const skillsAndTags = this.extractSkillsAndTags(context);

      if (skillsAndTags.length === 0) {
        this.logger.debug('No skills/tags to search for, skipping injection');
        return basePrompt;
      }

      // 2. 조직 지식 문서 검색
      const knowledgeDocs = await this.documentService.searchByTags(
        context.organizationId,
        skillsAndTags,
        {
          projectId: null, // 조직 레벨 지식만
          type: DocumentType.KNOWLEDGE,
          limit: 5, // 최대 5개 문서
        },
      );

      if (knowledgeDocs.length === 0) {
        this.logger.debug('No knowledge documents found');
        return basePrompt;
      }

      // 3. 프로젝트 관련 문서도 검색 (있으면)
      const projectDocs = context.projectId
        ? await this.documentService.searchByTags(
            context.organizationId,
            skillsAndTags,
            {
              projectId: context.projectId,
              type: DocumentType.KNOWLEDGE,
              limit: 3,
            },
          )
        : [];

      // 4. 지식 주입 섹션 생성
      const knowledgeSection = this.buildKnowledgeSection(
        knowledgeDocs,
        projectDocs,
      );

      // 5. 프롬프트에 지식 주입
      const enhancedPrompt = this.injectIntoPrompt(
        basePrompt,
        knowledgeSection,
        context,
      );

      this.logger.log(
        `✅ Knowledge injected: ${knowledgeDocs.length} org docs, ` +
          `${projectDocs.length} project docs`,
      );

      return enhancedPrompt;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to inject knowledge: ${errorMessage}, using base prompt`,
      );
      return basePrompt;
    }
  }

  /**
   * Task 및 컨텍스트에서 스킬과 태그 추출
   */
  private extractSkillsAndTags(context: KnowledgeContext): string[] {
    const skillsAndTags: string[] = [];

    if (context.task) {
      if (context.task.requiredSkills) {
        skillsAndTags.push(...context.task.requiredSkills);
      }
      if (context.task.tags) {
        skillsAndTags.push(...context.task.tags);
      }
      // Task type도 태그로 추가
      skillsAndTags.push(context.task.type);
    }

    if (context.requiredSkills) {
      skillsAndTags.push(...context.requiredSkills);
    }

    if (context.tags) {
      skillsAndTags.push(...context.tags);
    }

    // 중복 제거
    return [...new Set(skillsAndTags)];
  }

  /**
   * 지식 문서를 프롬프트 섹션으로 변환
   */
  private buildKnowledgeSection(orgDocs: any[], projectDocs: any[]): string {
    const sections: string[] = [];

    sections.push('# 🔑 Available Organization Knowledge\n');
    sections.push(
      'The following knowledge documents are available to help you complete this task. ' +
        'Use them as reference when making decisions or implementing solutions.\n',
    );

    // 조직 지식
    if (orgDocs.length > 0) {
      sections.push('## Organization-wide Knowledge\n');
      for (const doc of orgDocs) {
        sections.push(`### ${doc.title}\n`);
        sections.push(`**Tags**: ${doc.tags?.join(', ') || 'None'}\n`);
        sections.push('**Content**:');
        sections.push('```');
        // 문서 내용이 너무 길면 잘라내기 (2000자 제한)
        const content =
          doc.content.length > 2000
            ? doc.content.substring(0, 2000) + '\n... (truncated)'
            : doc.content;
        sections.push(content);
        sections.push('```\n');
      }
    }

    // 프로젝트 지식
    if (projectDocs.length > 0) {
      sections.push('## Project-specific Knowledge\n');
      for (const doc of projectDocs) {
        sections.push(`### ${doc.title}\n`);
        sections.push(`**Tags**: ${doc.tags?.join(', ') || 'None'}\n`);
        sections.push('**Content**:');
        sections.push('```');
        const content =
          doc.content.length > 2000
            ? doc.content.substring(0, 2000) + '\n... (truncated)'
            : doc.content;
        sections.push(content);
        sections.push('```\n');
      }
    }

    sections.push('---\n');

    return sections.join('\n');
  }

  /**
   * 지식 섹션을 프롬프트에 주입
   */
  private injectIntoPrompt(
    basePrompt: string,
    knowledgeSection: string,
    context: KnowledgeContext,
  ): string {
    // Task 정보가 있으면 Task 정보도 추가
    const taskInfo = context.task
      ? `# Task Information\n\n` +
        `**Title**: ${context.task.title}\n` +
        `**Type**: ${context.task.type}\n` +
        `**Priority**: ${context.task.priority}\n` +
        `**Description**:\n${context.task.description || 'N/A'}\n\n` +
        `**Required Skills**: ${context.task.requiredSkills?.join(', ') || 'None'}\n` +
        `**Tags**: ${context.task.tags?.join(', ') || 'None'}\n\n` +
        `---\n\n`
      : '';

    // 지식 주입 형식:
    // 1. Task 정보
    // 2. Available Knowledge
    // 3. 원본 프롬프트
    return `${taskInfo}${knowledgeSection}\n# Your Task\n\n${basePrompt}`;
  }

  /**
   * 지식 주입이 필요한지 확인
   */
  shouldInjectKnowledge(context: KnowledgeContext): boolean {
    const skillsAndTags = this.extractSkillsAndTags(context);
    return skillsAndTags.length > 0;
  }
}
