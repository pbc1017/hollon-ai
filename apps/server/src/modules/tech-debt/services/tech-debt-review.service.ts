import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../../task/entities/task.entity';
import {
  TechDebt,
  TechDebtCategory,
  TechDebtSeverity,
  TechDebtStatus,
} from '../entities/tech-debt.entity';
import { CreateTechDebtDto } from '../dto/create-tech-debt.dto';
import {
  TechDebtReviewResult,
  TechDebtReviewOptions,
} from '../dto/tech-debt-review-result.dto';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class TechDebtReviewService {
  private readonly logger = new Logger(TechDebtReviewService.name);

  constructor(
    @InjectRepository(TechDebt)
    private readonly techDebtRepo: Repository<TechDebt>,
  ) {}

  /**
   * 태스크 완료 후 기술부채 리뷰 실행
   * 코드 품질, 아키텍처, 문서화, 테스트 등을 검사
   */
  async reviewTaskForTechDebt(
    task: Task,
    options: TechDebtReviewOptions = {},
  ): Promise<TechDebtReviewResult> {
    this.logger.log(`Starting tech debt review for task ${task.id}`);

    const {
      checkCodeQuality = true,
      checkArchitecture = true,
      checkDocumentation = true,
      checkTesting = true,
      checkPerformance = false,
      checkSecurity = false,
      severityThreshold = 'low',
      autoCreateDebts = true,
    } = options;

    const detectedDebts: TechDebt[] = [];
    const recommendations: string[] = [];

    // 1. 코드 품질 검사
    if (checkCodeQuality && task.affectedFiles?.length > 0) {
      const qualityDebts = await this.checkCodeQuality(task);
      detectedDebts.push(...qualityDebts);
    }

    // 2. 아키텍처 검사
    if (checkArchitecture && task.affectedFiles?.length > 0) {
      const architectureDebts = await this.checkArchitecture(task);
      detectedDebts.push(...architectureDebts);
    }

    // 3. 문서화 검사
    if (checkDocumentation && task.affectedFiles?.length > 0) {
      const docDebts = await this.checkDocumentation(task);
      detectedDebts.push(...docDebts);
    }

    // 4. 테스트 커버리지 검사
    if (checkTesting && task.affectedFiles?.length > 0) {
      const testDebts = await this.checkTesting(task);
      detectedDebts.push(...testDebts);
    }

    // 5. 성능 검사 (선택적)
    if (checkPerformance && task.affectedFiles?.length > 0) {
      const perfDebts = await this.checkPerformance(task);
      detectedDebts.push(...perfDebts);
    }

    // 6. 보안 검사 (선택적)
    if (checkSecurity && task.affectedFiles?.length > 0) {
      const securityDebts = await this.checkSecurity(task);
      detectedDebts.push(...securityDebts);
    }

    // 심각도별 집계
    const severityCounts = {
      critical: detectedDebts.filter(
        (d) => d.severity === TechDebtSeverity.CRITICAL,
      ).length,
      high: detectedDebts.filter((d) => d.severity === TechDebtSeverity.HIGH)
        .length,
      medium: detectedDebts.filter(
        (d) => d.severity === TechDebtSeverity.MEDIUM,
      ).length,
      low: detectedDebts.filter((d) => d.severity === TechDebtSeverity.LOW)
        .length,
    };

    // 자동으로 기술부채 생성
    if (autoCreateDebts && detectedDebts.length > 0) {
      for (const debt of detectedDebts) {
        await this.techDebtRepo.save(debt);
      }
      this.logger.log(
        `Created ${detectedDebts.length} tech debt items for task ${task.id}`,
      );
    }

    // 추천사항 생성
    if (severityCounts.critical > 0) {
      recommendations.push(
        `Critical tech debt detected (${severityCounts.critical} items). Immediate action required.`,
      );
    }
    if (severityCounts.high > 0) {
      recommendations.push(
        `High priority tech debt detected (${severityCounts.high} items). Should be addressed soon.`,
      );
    }
    if (severityCounts.medium + severityCounts.low > 0) {
      recommendations.push(
        `${severityCounts.medium + severityCounts.low} lower priority tech debt items detected. Consider addressing in upcoming sprints.`,
      );
    }

    // 임계값에 따라 블로킹 여부 결정
    const shouldBlock = this.shouldBlockBasedOnThreshold(
      severityCounts,
      severityThreshold,
    );

    let blockReason: string | undefined;
    if (shouldBlock) {
      blockReason = `Tech debt severity exceeds threshold (${severityThreshold}). Found ${severityCounts.critical} critical, ${severityCounts.high} high severity issues.`;
    }

    return {
      taskId: task.id,
      detectedDebts,
      totalCount: detectedDebts.length,
      severityCounts,
      recommendations,
      shouldBlock,
      blockReason,
    };
  }

  /**
   * 코드 품질 검사 (ESLint, Prettier)
   */
  private async checkCodeQuality(task: Task): Promise<TechDebt[]> {
    const debts: TechDebt[] = [];

    if (!task.project?.workingDirectory) {
      return debts;
    }

    const existingFiles = task.affectedFiles.filter((file) =>
      existsSync(join(task.project!.workingDirectory!, file)),
    );

    if (existingFiles.length === 0) {
      return debts;
    }

    try {
      // ESLint 실행
      const files = existingFiles.join(' ');
      execSync(`npx eslint ${files} --format json`, {
        cwd: task.project.workingDirectory,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
    } catch (error: any) {
      // ESLint 오류 파싱
      try {
        const results = JSON.parse(error.stdout || '[]');
        for (const result of results) {
          if (result.errorCount > 0 || result.warningCount > 0) {
            const severity =
              result.errorCount > 0
                ? TechDebtSeverity.MEDIUM
                : TechDebtSeverity.LOW;

            const debt = this.techDebtRepo.create({
              title: `Code quality issues in ${result.filePath.split('/').pop()}`,
              description: `Found ${result.errorCount} errors and ${result.warningCount} warnings`,
              category: TechDebtCategory.CODE_QUALITY,
              severity,
              status: TechDebtStatus.IDENTIFIED,
              projectId: task.projectId,
              taskId: task.id,
              affectedFiles: [result.filePath],
              detectedBy: 'eslint',
              metadata: {
                errorCount: result.errorCount,
                warningCount: result.warningCount,
                messages: result.messages.slice(0, 5), // 처음 5개 메시지만 저장
              },
            });

            debts.push(debt);
          }
        }
      } catch (parseError) {
        this.logger.warn('Failed to parse ESLint output', parseError);
      }
    }

    return debts;
  }

  /**
   * 아키텍처 검사
   * - 순환 의존성
   * - 레이어 위반
   * - 과도한 결합도
   */
  private async checkArchitecture(task: Task): Promise<TechDebt[]> {
    const debts: TechDebt[] = [];

    // TODO: 실제 아키텍처 분석 도구 통합
    // 현재는 간단한 휴리스틱만 구현

    const affectedFiles = task.affectedFiles || [];

    // 파일 크기가 너무 큰 경우 (God Object)
    for (const file of affectedFiles) {
      if (!task.project?.workingDirectory) continue;

      const filePath = join(task.project.workingDirectory, file);
      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, 'utf-8');
          const lineCount = content.split('\n').length;

          if (lineCount > 500) {
            debts.push(
              this.techDebtRepo.create({
                title: `Large file detected: ${file}`,
                description: `File has ${lineCount} lines, exceeding recommended maximum of 500 lines`,
                category: TechDebtCategory.ARCHITECTURE,
                severity:
                  lineCount > 1000
                    ? TechDebtSeverity.HIGH
                    : TechDebtSeverity.MEDIUM,
                status: TechDebtStatus.IDENTIFIED,
                projectId: task.projectId,
                taskId: task.id,
                affectedFiles: [file],
                detectedBy: 'architecture-analyzer',
                estimatedEffortHours: Math.ceil(lineCount / 100),
                metadata: { lineCount },
              }),
            );
          }
        } catch (error) {
          this.logger.warn(`Failed to analyze file ${file}`, error);
        }
      }
    }

    return debts;
  }

  /**
   * 문서화 검사
   * - 주석 누락
   * - README 업데이트
   * - API 문서
   */
  private async checkDocumentation(task: Task): Promise<TechDebt[]> {
    const debts: TechDebt[] = [];

    const affectedFiles = task.affectedFiles || [];
    const codeFiles = affectedFiles.filter(
      (f) =>
        f.endsWith('.ts') ||
        f.endsWith('.js') ||
        f.endsWith('.tsx') ||
        f.endsWith('.jsx'),
    );

    for (const file of codeFiles) {
      if (!task.project?.workingDirectory) continue;

      const filePath = join(task.project.workingDirectory, file);
      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, 'utf-8');

          // 클래스/함수 정의 vs 주석 비율 체크
          const classOrFunctionCount = (
            content.match(/\b(class|function|const\s+\w+\s*=\s*\()/g) || []
          ).length;
          const commentCount = (content.match(/\/\*\*|\/\//g) || []).length;

          if (
            classOrFunctionCount > 5 &&
            commentCount < classOrFunctionCount / 2
          ) {
            debts.push(
              this.techDebtRepo.create({
                title: `Insufficient documentation in ${file}`,
                description: `Found ${classOrFunctionCount} functions/classes but only ${commentCount} comments`,
                category: TechDebtCategory.DOCUMENTATION,
                severity: TechDebtSeverity.LOW,
                status: TechDebtStatus.IDENTIFIED,
                projectId: task.projectId,
                taskId: task.id,
                affectedFiles: [file],
                detectedBy: 'doc-analyzer',
                estimatedEffortHours: 2,
                metadata: {
                  classOrFunctionCount,
                  commentCount,
                },
              }),
            );
          }
        } catch (error) {
          this.logger.warn(`Failed to check documentation for ${file}`, error);
        }
      }
    }

    return debts;
  }

  /**
   * 테스트 커버리지 검사
   */
  private async checkTesting(task: Task): Promise<TechDebt[]> {
    const debts: TechDebt[] = [];

    const affectedFiles = task.affectedFiles || [];
    const sourceFiles = affectedFiles.filter(
      (f) => !f.includes('.spec.') && !f.includes('.test.'),
    );

    // 각 소스 파일에 대응하는 테스트 파일이 있는지 확인
    for (const sourceFile of sourceFiles) {
      if (!task.project?.workingDirectory) continue;

      const testFile = sourceFile
        .replace(/\.(ts|js|tsx|jsx)$/, '.spec.$1')
        .replace(/src\//, 'test/');

      const testFilePath = join(task.project.workingDirectory, testFile);
      const hasTestFile = existsSync(testFilePath);

      if (!hasTestFile) {
        debts.push(
          this.techDebtRepo.create({
            title: `Missing test file for ${sourceFile}`,
            description: `No test file found for ${sourceFile}. Expected: ${testFile}`,
            category: TechDebtCategory.TESTING,
            severity: TechDebtSeverity.MEDIUM,
            status: TechDebtStatus.IDENTIFIED,
            projectId: task.projectId,
            taskId: task.id,
            affectedFiles: [sourceFile],
            detectedBy: 'test-coverage-analyzer',
            estimatedEffortHours: 3,
            metadata: {
              expectedTestFile: testFile,
            },
          }),
        );
      }
    }

    return debts;
  }

  /**
   * 성능 검사 (선택적)
   */
  private async checkPerformance(task: Task): Promise<TechDebt[]> {
    const debts: TechDebt[] = [];

    // TODO: 성능 분석 도구 통합
    // 예: N+1 쿼리, 불필요한 렌더링, 메모리 누수 등

    const affectedFiles = task.affectedFiles || [];

    for (const file of affectedFiles) {
      if (!task.project?.workingDirectory) continue;

      const filePath = join(task.project.workingDirectory, file);
      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, 'utf-8');

          // 간단한 휴리스틱: 중첩 루프 감지
          const nestedLoopPattern = /for\s*\([^)]+\)\s*{[^}]*for\s*\([^)]+\)/g;
          const nestedLoops = content.match(nestedLoopPattern) || [];

          if (nestedLoops.length > 0) {
            debts.push(
              this.techDebtRepo.create({
                title: `Potential performance issue in ${file}`,
                description: `Found ${nestedLoops.length} nested loops which may cause O(n²) performance`,
                category: TechDebtCategory.PERFORMANCE,
                severity: TechDebtSeverity.MEDIUM,
                status: TechDebtStatus.IDENTIFIED,
                projectId: task.projectId,
                taskId: task.id,
                affectedFiles: [file],
                detectedBy: 'performance-analyzer',
                estimatedEffortHours: 4,
                metadata: {
                  nestedLoopCount: nestedLoops.length,
                },
              }),
            );
          }
        } catch (error) {
          this.logger.warn(`Failed to check performance for ${file}`, error);
        }
      }
    }

    return debts;
  }

  /**
   * 보안 검사 (선택적)
   */
  private async checkSecurity(task: Task): Promise<TechDebt[]> {
    const debts: TechDebt[] = [];

    // TODO: 보안 스캐너 통합 (예: npm audit, Snyk)

    const affectedFiles = task.affectedFiles || [];

    for (const file of affectedFiles) {
      if (!task.project?.workingDirectory) continue;

      const filePath = join(task.project.workingDirectory, file);
      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, 'utf-8');

          // 간단한 보안 패턴 검사
          const insecurePatterns = [
            {
              pattern: /eval\s*\(/,
              name: 'eval usage',
              severity: TechDebtSeverity.CRITICAL,
            },
            {
              pattern: /innerHTML\s*=/,
              name: 'innerHTML assignment',
              severity: TechDebtSeverity.HIGH,
            },
            {
              pattern: /password\s*=\s*['"][^'"]+['"]/,
              name: 'hardcoded password',
              severity: TechDebtSeverity.CRITICAL,
            },
          ];

          for (const { pattern, name, severity } of insecurePatterns) {
            if (pattern.test(content)) {
              debts.push(
                this.techDebtRepo.create({
                  title: `Security issue in ${file}: ${name}`,
                  description: `Detected potentially insecure pattern: ${name}`,
                  category: TechDebtCategory.SECURITY,
                  severity,
                  status: TechDebtStatus.IDENTIFIED,
                  projectId: task.projectId,
                  taskId: task.id,
                  affectedFiles: [file],
                  detectedBy: 'security-scanner',
                  estimatedEffortHours: 2,
                  metadata: {
                    pattern: name,
                  },
                }),
              );
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to check security for ${file}`, error);
        }
      }
    }

    return debts;
  }

  /**
   * 임계값 기반 블로킹 판단
   */
  private shouldBlockBasedOnThreshold(
    severityCounts: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    },
    threshold: 'low' | 'medium' | 'high' | 'critical',
  ): boolean {
    switch (threshold) {
      case 'critical':
        return severityCounts.critical > 0;
      case 'high':
        return severityCounts.critical > 0 || severityCounts.high > 0;
      case 'medium':
        return (
          severityCounts.critical > 0 ||
          severityCounts.high > 0 ||
          severityCounts.medium > 3
        );
      case 'low':
        return (
          severityCounts.critical > 0 ||
          severityCounts.high > 2 ||
          severityCounts.medium > 5
        );
      default:
        return false;
    }
  }

  /**
   * 프로젝트의 모든 기술부채 조회
   */
  async findAllByProject(projectId: string): Promise<TechDebt[]> {
    return this.techDebtRepo.find({
      where: { projectId },
      order: {
        severity: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  /**
   * 기술부채 생성
   */
  async create(dto: CreateTechDebtDto): Promise<TechDebt> {
    const debt = this.techDebtRepo.create(dto);
    return this.techDebtRepo.save(debt);
  }

  /**
   * 기술부채 해결
   */
  async resolve(id: string, resolutionNotes: string): Promise<TechDebt> {
    const debt = await this.techDebtRepo.findOne({ where: { id } });
    if (!debt) {
      throw new Error(`Tech debt #${id} not found`);
    }

    debt.status = TechDebtStatus.RESOLVED;
    debt.resolvedAt = new Date();
    debt.resolutionNotes = resolutionNotes;

    return this.techDebtRepo.save(debt);
  }

  /**
   * 기술부채 통계
   */
  async getStatistics(projectId: string): Promise<{
    total: number;
    bySeverity: Record<TechDebtSeverity, number>;
    byCategory: Record<TechDebtCategory, number>;
    byStatus: Record<TechDebtStatus, number>;
    totalEstimatedEffort: number;
  }> {
    const debts = await this.findAllByProject(projectId);

    const bySeverity = debts.reduce(
      (acc, debt) => {
        acc[debt.severity] = (acc[debt.severity] || 0) + 1;
        return acc;
      },
      {} as Record<TechDebtSeverity, number>,
    );

    const byCategory = debts.reduce(
      (acc, debt) => {
        acc[debt.category] = (acc[debt.category] || 0) + 1;
        return acc;
      },
      {} as Record<TechDebtCategory, number>,
    );

    const byStatus = debts.reduce(
      (acc, debt) => {
        acc[debt.status] = (acc[debt.status] || 0) + 1;
        return acc;
      },
      {} as Record<TechDebtStatus, number>,
    );

    const totalEstimatedEffort = debts.reduce(
      (sum, debt) => sum + (debt.estimatedEffortHours || 0),
      0,
    );

    return {
      total: debts.length,
      bySeverity,
      byCategory,
      byStatus,
      totalEstimatedEffort,
    };
  }
}
