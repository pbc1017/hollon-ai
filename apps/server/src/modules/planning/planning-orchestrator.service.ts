import { Injectable, Logger, Inject } from '@nestjs/common';

import { Task } from '../task/entities/task.entity';
import { Hollon } from '../hollon/entities/hollon.entity';
import { BrainProviderService } from '../brain-provider/brain-provider.service';
import { IHollonService } from '../hollon/domain/hollon-service.interface';

/**
 * Phase 4.3: Planning Orchestrator Service
 *
 * Manager/TeamMember가 여러 전문가 Sub-Hollon을 생성하여
 * 다양한 관점에서 분석한 후 종합적인 계획을 수립합니다.
 *
 * 핵심 원칙:
 * - 각 Sub-Hollon은 분석만 수행 (코드 수정 금지)
 * - disallowedTools: ['Write', 'Edit', 'Bash', 'MultiEdit']
 * - 기존 createTemporaryHollon 로직 재활용
 */

export interface SpecialistAnalysis {
  role: string;
  hollonId: string;
  content: string;
  success: boolean;
  error?: string;
}

export interface OrchestratedPlanResult {
  success: boolean;
  analyses: SpecialistAnalysis[];
  aggregatedPlan?: string;
  error?: string;
}

interface SpecialistSpec {
  roleId: string;
  roleName: string;
  perspective: string;
  prompt: string;
  focusAreas: string[];
}

@Injectable()
export class PlanningOrchestratorService {
  private readonly logger = new Logger(PlanningOrchestratorService.name);

  /**
   * Planning Mode에서 금지되는 도구들
   * 분석만 허용, 코드 수정 금지
   */
  private readonly PLANNING_DISALLOWED_TOOLS = [
    'Write',
    'Edit',
    'Bash',
    'MultiEdit',
  ];

  /**
   * 전문가 Specialist 정의
   * 기존 Role들을 활용하여 다양한 관점에서 분석
   */
  private readonly SPECIALIST_SPECS: SpecialistSpec[] = [
    {
      roleId: '9ad5879a-6bb0-46fc-a786-698a668dd242', // TechnicalLead
      roleName: 'ArchitectAnalyst',
      perspective: 'Architecture & System Design',
      focusAreas: [
        'system architecture',
        'design patterns',
        'scalability',
        'maintainability',
      ],
      prompt: `You are an Architecture Analyst. Your role is to analyze the implementation task from an architectural perspective.

Focus on:
1. **System Architecture Impact**: How will this change affect the overall system architecture?
2. **Design Patterns**: What design patterns should be applied? Are there anti-patterns to avoid?
3. **Modularity & Coupling**: How can we ensure loose coupling and high cohesion?
4. **Scalability Considerations**: Will this implementation scale well?
5. **Technical Debt**: Are there any technical debt implications?

IMPORTANT: You are in ANALYSIS MODE ONLY. Do NOT modify any code.
- Use Read, Glob, Grep tools to explore the codebase
- Provide detailed architectural recommendations
- Identify potential risks and mitigation strategies`,
    },
    {
      roleId: '1eedfda3-3eb9-4f6a-8588-4a7a41a4c930', // QAEngineer
      roleName: 'QualityAnalyst',
      perspective: 'Testing & Quality Assurance',
      focusAreas: [
        'test strategy',
        'coverage requirements',
        'edge cases',
        'quality gates',
      ],
      prompt: `You are a Quality Analyst. Your role is to analyze the implementation task from a testing and quality perspective.

Focus on:
1. **Test Strategy**: What types of tests are needed? (unit, integration, e2e)
2. **Test Coverage**: What are the critical paths that must be tested?
3. **Edge Cases**: What edge cases and error scenarios should be considered?
4. **Quality Gates**: What quality metrics should be met before deployment?
5. **Regression Risk**: What existing functionality might be affected?

IMPORTANT: You are in ANALYSIS MODE ONLY. Do NOT modify any code.
- Use Read, Glob, Grep tools to explore existing tests
- Provide specific test scenarios and acceptance criteria
- Identify potential quality risks`,
    },
    {
      roleId: 'ffcd2f37-4e69-4b45-8a7e-5c56b96996fc', // BackendEngineer
      roleName: 'ImplementationAnalyst',
      perspective: 'Implementation Details',
      focusAreas: [
        'implementation approach',
        'code organization',
        'dependencies',
        'migration path',
      ],
      prompt: `You are an Implementation Analyst. Your role is to analyze the implementation task from a practical coding perspective.

Focus on:
1. **Implementation Approach**: What is the best approach to implement this?
2. **Code Organization**: How should the code be structured and organized?
3. **Dependencies**: What dependencies are needed? Are there conflicts?
4. **Migration Path**: How to migrate existing code/data if needed?
5. **Effort Estimation**: Break down into specific subtasks with complexity

IMPORTANT: You are in ANALYSIS MODE ONLY. Do NOT modify any code.
- Use Read, Glob, Grep tools to understand existing patterns
- Provide concrete implementation recommendations
- Identify potential blockers and dependencies`,
    },
  ];

  constructor(
    @Inject('IHollonService')
    private readonly hollonService: IHollonService,
    private readonly brainProviderService: BrainProviderService,
  ) {}

  /**
   * 다중 전문가를 통한 계획 오케스트레이션
   */
  async orchestratePlanning(
    parentTask: Task,
    orchestratorHollon: Hollon,
    worktreePath: string,
  ): Promise<OrchestratedPlanResult> {
    this.logger.log(
      `Starting orchestrated planning for task: ${parentTask.id}`,
    );
    this.logger.log(
      `Orchestrator: ${orchestratorHollon.name} (${orchestratorHollon.id.substring(0, 8)})`,
    );

    const analyses: SpecialistAnalysis[] = [];

    try {
      // 각 전문가 Sub-Hollon으로 분석 실행
      for (const spec of this.SPECIALIST_SPECS) {
        this.logger.log(`Creating specialist: ${spec.roleName}`);

        const analysis = await this.executeSpecialistAnalysis(
          spec,
          parentTask,
          orchestratorHollon,
          worktreePath,
        );

        analyses.push(analysis);

        if (analysis.success) {
          this.logger.log(
            `✅ ${spec.roleName} analysis completed (${analysis.content.length} chars)`,
          );
        } else {
          this.logger.warn(
            `⚠️ ${spec.roleName} analysis failed: ${analysis.error}`,
          );
        }
      }

      // 분석 결과 집계
      const aggregatedPlan = this.aggregateAnalyses(analyses, parentTask);

      return {
        success: true,
        analyses,
        aggregatedPlan,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Orchestrated planning failed: ${err.message}`);
      return {
        success: false,
        analyses,
        error: err.message,
      };
    }
  }

  /**
   * 개별 전문가 분석 실행
   */
  private async executeSpecialistAnalysis(
    spec: SpecialistSpec,
    parentTask: Task,
    orchestratorHollon: Hollon,
    worktreePath: string,
  ): Promise<SpecialistAnalysis> {
    let subHollon: Hollon | null = null;

    try {
      // 1. 임시 Sub-Hollon 생성
      subHollon = await this.hollonService.createTemporaryHollon({
        name: `${spec.roleName}-${parentTask.id.substring(0, 8)}`,
        organizationId: orchestratorHollon.organizationId,
        teamId: orchestratorHollon.teamId || undefined,
        roleId: spec.roleId,
        brainProviderId: orchestratorHollon.brainProviderId || 'claude_code',
        systemPrompt: spec.prompt,
        createdBy: orchestratorHollon.id,
      });

      this.logger.log(
        `Created sub-hollon: ${subHollon.name} (${subHollon.id.substring(0, 8)})`,
      );

      // 2. 분석 프롬프트 생성
      const analysisPrompt = this.buildAnalysisPrompt(spec, parentTask);

      // 3. Brain Provider 실행 (분석 모드 - 코드 수정 금지)
      const result = await this.brainProviderService.executeWithTracking(
        {
          prompt: analysisPrompt,
          context: {
            hollonId: subHollon.id,
            taskId: parentTask.id,
            workingDirectory: worktreePath,
          },
          options: {
            timeoutMs: 180000, // 3분 per specialist
            disallowedTools: this.PLANNING_DISALLOWED_TOOLS,
          },
        },
        {
          organizationId: orchestratorHollon.organizationId,
          hollonId: subHollon.id,
          taskId: parentTask.id,
        },
      );

      return {
        role: spec.roleName,
        hollonId: subHollon.id,
        content: result.output || '',
        success: result.success,
        error: result.success ? undefined : result.output,
      };
    } catch (error) {
      const err = error as Error;
      return {
        role: spec.roleName,
        hollonId: subHollon?.id || 'unknown',
        content: '',
        success: false,
        error: err.message,
      };
    } finally {
      // 4. 임시 Sub-Hollon 정리
      if (subHollon) {
        try {
          await this.hollonService.deleteTemporary(subHollon.id);
          this.logger.log(
            `Cleaned up sub-hollon: ${subHollon.id.substring(0, 8)}`,
          );
        } catch (cleanupError) {
          this.logger.warn(
            `Failed to cleanup sub-hollon: ${(cleanupError as Error).message}`,
          );
        }
      }
    }
  }

  /**
   * 전문가별 분석 프롬프트 생성
   */
  private buildAnalysisPrompt(spec: SpecialistSpec, task: Task): string {
    return `# Analysis Task: ${spec.perspective}

## Task Information
- **Title**: ${task.title}
- **Description**: ${task.description || 'No description provided'}
- **Type**: ${task.type}
- **Priority**: ${task.priority}

## Your Focus Areas
${spec.focusAreas.map((area) => `- ${area}`).join('\n')}

## Instructions
${spec.prompt}

## Expected Output Format
Please provide your analysis in the following structure:

### Summary
A brief summary of your findings (2-3 sentences)

### Key Findings
1. [Finding 1]
2. [Finding 2]
...

### Recommendations
1. [Recommendation 1]
2. [Recommendation 2]
...

### Risks & Concerns
- [Risk 1]
- [Risk 2]
...

### Estimated Effort
- Complexity: [Low/Medium/High]
- Suggested subtasks: [List of specific implementation subtasks]

---
Begin your analysis now. Remember: ANALYSIS ONLY, no code modifications.`;
  }

  /**
   * 전문가 분석 결과를 종합 계획으로 집계
   */
  private aggregateAnalyses(
    analyses: SpecialistAnalysis[],
    task: Task,
  ): string {
    const successfulAnalyses = analyses.filter((a) => a.success);
    const failedAnalyses = analyses.filter((a) => !a.success);

    const sections: string[] = [
      `# Implementation Plan: ${task.title}`,
      '',
      `> Auto-generated by Hollon Planning Orchestrator (Phase 4.3)`,
      `> Generated at: ${new Date().toISOString()}`,
      '',
      '## Executive Summary',
      '',
      `This plan was created through multi-perspective analysis by ${successfulAnalyses.length} specialists.`,
      '',
    ];

    // 분석 상태 요약
    if (failedAnalyses.length > 0) {
      sections.push('### Analysis Status');
      sections.push('');
      sections.push(
        `⚠️ ${failedAnalyses.length} analysis(es) failed: ${failedAnalyses.map((a) => a.role).join(', ')}`,
      );
      sections.push('');
    }

    // 각 전문가 분석 결과 추가
    for (const analysis of successfulAnalyses) {
      sections.push(`---`);
      sections.push('');
      sections.push(`## ${this.getRoleSectionTitle(analysis.role)}`);
      sections.push('');
      sections.push(analysis.content);
      sections.push('');
    }

    // 실패한 분석에 대한 노트
    if (failedAnalyses.length > 0) {
      sections.push('---');
      sections.push('');
      sections.push('## Failed Analyses');
      sections.push('');
      for (const analysis of failedAnalyses) {
        sections.push(`### ${analysis.role}`);
        sections.push(`Error: ${analysis.error}`);
        sections.push('');
      }
    }

    // 메타데이터
    sections.push('---');
    sections.push('');
    sections.push('## Metadata');
    sections.push('');
    sections.push(`- Task ID: ${task.id}`);
    sections.push(`- Task Type: ${task.type}`);
    sections.push(`- Priority: ${task.priority}`);
    sections.push(`- Specialists Consulted: ${analyses.length}`);
    sections.push(`- Successful Analyses: ${successfulAnalyses.length}`);

    return sections.join('\n');
  }

  /**
   * Role 이름을 읽기 좋은 섹션 제목으로 변환
   */
  private getRoleSectionTitle(role: string): string {
    const titles: Record<string, string> = {
      ArchitectAnalyst: '🏗️ Architecture Analysis',
      QualityAnalyst: '✅ Quality & Testing Analysis',
      ImplementationAnalyst: '💻 Implementation Analysis',
    };
    return titles[role] || role;
  }
}
