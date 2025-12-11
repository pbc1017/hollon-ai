import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join, resolve } from 'path';
import { Organization } from '../modules/organization/entities/organization.entity';
import { Role } from '../modules/role/entities/role.entity';
import { Team } from '../modules/team/entities/team.entity';
import { Hollon, HollonStatus } from '../modules/hollon/entities/hollon.entity';
import {
  Project,
  ProjectStatus,
} from '../modules/project/entities/project.entity';
import { BrainProviderConfig } from '../modules/brain-provider/entities/brain-provider-config.entity';
import {
  Task,
  TaskStatus,
  TaskPriority,
} from '../modules/task/entities/task.entity';

// Load environment variables from project root
const projectRoot = resolve(__dirname, '../../../..');
dotenv.config({ path: join(projectRoot, '.env.local') });
dotenv.config({ path: join(projectRoot, '.env') });

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'hollon',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hollon',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
});

async function seed() {
  await dataSource.initialize();
  console.log('🌱 Starting database seeding...');

  try {
    // 0. Clear existing data (in correct order for foreign key constraints)
    console.log('🧹 Clearing existing seed data...');
    await dataSource.query('DELETE FROM hollon.tasks WHERE 1=1');
    await dataSource.query('DELETE FROM hollon.hollons WHERE 1=1');
    await dataSource.query('DELETE FROM hollon.projects WHERE 1=1');
    await dataSource.query('DELETE FROM hollon.teams WHERE 1=1');
    await dataSource.query('DELETE FROM hollon.roles WHERE 1=1');
    await dataSource.query(
      'DELETE FROM hollon.brain_provider_configs WHERE 1=1',
    );
    await dataSource.query('DELETE FROM hollon.organizations WHERE 1=1');
    console.log('✅ Existing data cleared');

    // 1. Create Organization
    console.log('📦 Creating organization...');
    const orgRepo = dataSource.getRepository(Organization);
    const org = orgRepo.create({
      name: 'Hollon-AI Dev',
      description: '우리는 고품질 소프트웨어를 만드는 팀입니다',
      settings: {
        costLimitDailyCents: 10000, // $100/day
        costLimitMonthlyCents: 100000, // $1000/month
        maxHollonsPerTeam: 10,
        defaultTaskPriority: 'medium',
      },
    });
    await orgRepo.save(org);
    console.log(`✅ Organization created: ${org.name} (${org.id})`);

    // 2. Create Brain Provider Config
    console.log('🧠 Creating brain provider config...');
    const providerRepo = dataSource.getRepository(BrainProviderConfig);
    const claudeCodeProvider = providerRepo.create({
      organizationId: org.id,
      providerId: 'claude_code',
      displayName: 'Claude Code',
      config: {
        cliPath: process.env.CLAUDE_CODE_PATH || 'claude',
        model: 'claude-sonnet-4-5',
        timeout: 300000, // 5 minutes
      },
      costPerInputTokenCents: 0.003, // $3 per 1M tokens
      costPerOutputTokenCents: 0.015, // $15 per 1M tokens
      enabled: true,
      timeoutSeconds: 300,
      maxRetries: 3,
    });
    await providerRepo.save(claudeCodeProvider);
    console.log(`✅ Brain Provider created: ${claudeCodeProvider.displayName}`);

    // 3. Create Roles
    console.log('👤 Creating roles...');
    const roleRepo = dataSource.getRepository(Role);

    const backendRole = roleRepo.create({
      organizationId: org.id,
      name: 'BackendEngineer',
      description: 'TypeScript/NestJS 백엔드 개발 전문가',
      systemPrompt: `당신은 TypeScript/NestJS 전문 백엔드 엔지니어입니다.
당신의 임무:
- 깨끗하고 유지보수 가능한 코드 작성
- RESTful API 설계 및 구현
- 데이터베이스 스키마 설계 (PostgreSQL/TypeORM)
- 에러 처리 및 검증 로직 구현
- 단위 테스트 작성

코딩 스타일:
- TypeScript strict 모드 준수
- 명확한 타입 정의
- 함수는 단일 책임 원칙 준수
- 주석은 "왜"를 설명, "무엇"은 코드로 표현`,
      capabilities: [
        'typescript',
        'nestjs',
        'postgresql',
        'typeorm',
        'rest-api',
      ],
    });

    const frontendRole = roleRepo.create({
      organizationId: org.id,
      name: 'FrontendEngineer',
      description: 'React/Next.js 프론트엔드 개발 전문가',
      systemPrompt: `당신은 React/Next.js 전문 프론트엔드 엔지니어입니다.
당신의 임무:
- 사용자 친화적인 UI/UX 구현
- 컴포넌트 기반 아키텍처 설계
- 상태 관리 (React hooks, Context)
- API 연동 및 에러 핸들링
- 반응형 디자인 구현

코딩 스타일:
- 함수형 컴포넌트 및 hooks 사용
- 재사용 가능한 컴포넌트 설계
- Tailwind CSS 활용
- 접근성(a11y) 고려`,
      capabilities: [
        'typescript',
        'react',
        'nextjs',
        'tailwind',
        'responsive-design',
      ],
    });

    const qaRole = roleRepo.create({
      organizationId: org.id,
      name: 'QAEngineer',
      description: '품질 보증 및 테스트 전문가',
      systemPrompt: `당신은 소프트웨어 품질 보증 전문가입니다.
당신의 임무:
- E2E 테스트 시나리오 작성 및 실행
- 단위 테스트 및 통합 테스트 작성
- 버그 재현 및 리포팅
- 성능 및 보안 테스트
- 코드 리뷰 참여

테스트 철학:
- 중요한 비즈니스 로직 우선 테스트
- 엣지 케이스 고려
- 명확한 테스트 케이스 작성
- 자동화 가능한 테스트 설계`,
      capabilities: ['jest', 'testing', 'debugging', 'performance-testing'],
    });

    // Phase 3.8: Manager Role
    const managerRole = roleRepo.create({
      organizationId: org.id,
      name: 'Manager',
      description: '팀 매니저 - Task 분배 및 팀 조정 전문가',
      systemPrompt: `당신은 팀 매니저입니다.
당신의 임무:
- Team Task를 팀원들에게 효율적으로 분배
- 각 팀원의 스킬과 현재 업무량 고려
- 의존성 파악 및 병렬 실행 최적화
- 블로커 감지 및 재분배 결정
- 팀 협업 조정

분배 원칙:
- 스킬 매칭 우선
- 워크로드 밸런싱
- 의존성 순서 고려
- 협업 기회 활용`,
      capabilities: [
        'task-distribution',
        'coordination',
        'team-management',
        'workload-balancing',
      ],
    });

    // Phase 4: AI Engineer Role
    const aiEngineerRole = roleRepo.create({
      organizationId: org.id,
      name: 'AIEngineer',
      description: 'NLP, Embedding, Vector 검색 전문가',
      systemPrompt: `당신은 AI/ML 엔지니어입니다.
당신의 임무:
- NLP 및 Embedding 시스템 구현
- Vector similarity search 최적화
- OpenAI API 연동
- Knowledge extraction 로직 구현
- pgvector 인덱스 튜닝

기술 스택:
- OpenAI Embedding API
- pgvector (ivfflat index)
- TypeScript/NestJS
- Vector similarity algorithms`,
      capabilities: [
        'nlp',
        'embedding',
        'vector',
        'openai-api',
        'pgvector',
        'typescript',
        'nestjs',
      ],
    });

    // Phase 4: Data Engineer Role
    const dataEngineerRole = roleRepo.create({
      organizationId: org.id,
      name: 'DataEngineer',
      description: 'Graph, Database, Data Modeling 전문가',
      systemPrompt: `당신은 데이터 엔지니어입니다.
당신의 임무:
- Knowledge Graph 설계 및 구현
- Document relationships 모델링
- PostgreSQL 데이터베이스 최적화
- 성능 분석 및 인덱스 튜닝
- ETL 파이프라인 구축

기술 스택:
- PostgreSQL/TypeORM
- Graph algorithms
- Data modeling
- Performance optimization`,
      capabilities: [
        'graph',
        'database',
        'postgresql',
        'data-modeling',
        'typescript',
        'nestjs',
      ],
    });

    await roleRepo.save([
      backendRole,
      frontendRole,
      qaRole,
      managerRole,
      aiEngineerRole,
      dataEngineerRole,
    ]);
    console.log(
      `✅ Roles created: ${backendRole.name}, ${frontendRole.name}, ${qaRole.name}, ${managerRole.name}, ${aiEngineerRole.name}, ${dataEngineerRole.name}`,
    );

    // 4. Create Team
    console.log('🏢 Creating team...');
    const teamRepo = dataSource.getRepository(Team);
    const coreTeam = teamRepo.create({
      organizationId: org.id,
      name: 'Core Development',
      description: 'Phase 1 MVP 개발 팀',
    });
    await teamRepo.save(coreTeam);
    console.log(`✅ Team created: ${coreTeam.name} (${coreTeam.id})`);

    // 5. Create Hollons
    console.log('🤖 Creating hollons...');
    const hollonRepo = dataSource.getRepository(Hollon);

    const hollonAlpha = hollonRepo.create({
      name: 'Alpha',
      organizationId: org.id,
      teamId: coreTeam.id,
      roleId: backendRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 1,
      systemPrompt:
        '당신은 Alpha입니다. 백엔드 개발에 집중하며, 특히 API 엔드포인트와 비즈니스 로직 구현을 담당합니다.',
    });

    const hollonBeta = hollonRepo.create({
      name: 'Beta',
      organizationId: org.id,
      teamId: coreTeam.id,
      roleId: backendRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 1,
      systemPrompt:
        '당신은 Beta입니다. 백엔드 개발에 집중하며, 특히 데이터베이스 스키마와 엔티티 구현을 담당합니다.',
    });

    await hollonRepo.save([hollonAlpha, hollonBeta]);
    console.log(`✅ Hollons created: ${hollonAlpha.name}, ${hollonBeta.name}`);

    // 6. Create Project
    console.log('📋 Creating project...');
    const projectRepo = dataSource.getRepository(Project);
    const phase1Project = projectRepo.create({
      organizationId: org.id,
      name: 'Phase 1: MVP Core',
      description:
        '자율 실행 엔진 구현 - 홀론이 태스크를 Pull → 실행 → 완료하는 사이클',
      repositoryUrl: 'https://github.com/your-org/hollon-ai',
      workingDirectory: projectRoot, // Use actual project root path
      status: ProjectStatus.ACTIVE,
    });
    await projectRepo.save(phase1Project);
    console.log(
      `✅ Project created: ${phase1Project.name} (${phase1Project.id})`,
    );

    // 7. Create Tasks
    console.log('📝 Creating tasks...');
    const taskRepo = dataSource.getRepository(Task);

    const task1 = taskRepo.create({
      projectId: phase1Project.id,
      title: 'README.md 파일 작성',
      description: `프로젝트의 README.md 파일을 작성하세요.
내용:
- 프로젝트 소개 (Hollon-AI는 재귀적 멀티 에이전트 시스템입니다)
- 주요 기능 (자율 태스크 실행, 협업 시스템, 품질 검증)
- 빠른 시작 가이드
- 기술 스택 (NestJS, TypeORM, PostgreSQL, Claude Code)`,
      status: TaskStatus.READY,
      priority: TaskPriority.P3_MEDIUM,
      affectedFiles: ['README.md'],
    });

    const task2 = taskRepo.create({
      projectId: phase1Project.id,
      title: 'Organization 엔티티에 contextPrompt 필드 추가',
      description: `Organization 엔티티에 contextPrompt 필드를 추가하여 조직 수준의 프롬프트를 저장할 수 있도록 합니다.
요구사항:
- organization.entity.ts 파일 수정
- contextPrompt 필드 추가 (type: text, nullable: true)
- 마이그레이션 파일 생성
- 단위 테스트 작성`,
      status: TaskStatus.READY,
      priority: TaskPriority.P2_HIGH,
      affectedFiles: [
        'src/modules/organization/entities/organization.entity.ts',
      ],
    });

    const task3 = taskRepo.create({
      projectId: phase1Project.id,
      title: 'Health check 엔드포인트 개선',
      description: `Health check 엔드포인트를 개선하여 더 자세한 시스템 상태 정보를 제공합니다.
추가할 정보:
- 데이터베이스 연결 상태
- 활성 홀론 수
- 진행중인 태스크 수
- 메모리 사용량`,
      status: TaskStatus.READY,
      priority: TaskPriority.P4_LOW,
      affectedFiles: ['src/modules/health/health.controller.ts'],
    });

    await taskRepo.save([task1, task2, task3]);
    console.log(`✅ Tasks created: 3 tasks for ${phase1Project.name}`);

    // ========================================
    // 🐕 DOGFOODING: Hollon이 Hollon을 개발
    // ========================================
    console.log('\n🐕 Creating Dogfooding setup...');

    // Dogfooding Team
    const dogfoodingTeam = teamRepo.create({
      organizationId: org.id,
      name: 'Dogfooding Team',
      description:
        'Hollon-AI로 Hollon-AI를 개발하는 팀 - Phase 2 미완성 항목 구현',
    });
    await teamRepo.save(dogfoodingTeam);
    console.log(`✅ Dogfooding Team created: ${dogfoodingTeam.name}`);

    // Phase 3.8: Manager Hollon for Dogfooding Team
    const managerHollon = hollonRepo.create({
      name: 'Manager-Dogfood',
      organizationId: org.id,
      teamId: dogfoodingTeam.id,
      roleId: managerRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 1,
      systemPrompt: `당신은 Manager-Dogfood입니다. Dogfooding Team의 매니저로서 팀 Task 분배를 담당합니다.

특별 지침:
- Team Task를 받으면 팀원들의 스킬과 업무량을 고려하여 분배
- DevBot-1, DevBot-2: 백엔드 개발 (서비스 로직, 테스트)
- ReviewBot: 테스트 작성 및 코드 리뷰
- 의존성을 파악하여 병렬 실행 가능한 Task 우선 배치
- 블로커 발생 시 재분배 결정`,
    });

    await hollonRepo.save(managerHollon);

    // Assign Manager to Team
    await teamRepo.update(dogfoodingTeam.id, {
      managerHollonId: managerHollon.id,
    });
    console.log(
      `✅ Manager Hollon created and assigned: ${managerHollon.name} → ${dogfoodingTeam.name}`,
    );

    // Dogfooding Hollons - 3개 (동시성 테스트용)
    const hollonDogfood1 = hollonRepo.create({
      name: 'DevBot-1',
      organizationId: org.id,
      teamId: dogfoodingTeam.id,
      roleId: backendRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 1,
      systemPrompt: `당신은 DevBot-1입니다. Hollon-AI 시스템을 개발하는 백엔드 엔지니어입니다.

특별 지침:
- 이 프로젝트는 "Hollon-AI"라는 멀티 에이전트 시스템입니다
- phase2-plan.md와 ssot.md를 참고하여 구현 방향을 이해하세요
- 기존 코드 스타일을 철저히 따르세요 (다른 서비스 파일들 참고)
- 모든 변경사항은 테스트와 함께 제공하세요
- NestJS의 의존성 주입, 데코레이터 패턴을 준수하세요`,
    });

    const hollonDogfood2 = hollonRepo.create({
      name: 'DevBot-2',
      organizationId: org.id,
      teamId: dogfoodingTeam.id,
      roleId: backendRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 1,
      systemPrompt: `당신은 DevBot-2입니다. Hollon-AI 시스템을 개발하는 백엔드 엔지니어입니다.

특별 지침:
- DevBot-1과 협력하여 작업을 수행합니다
- 주로 서비스 로직 개선과 테스트 작성을 담당합니다
- 코드 리뷰 시 건설적인 피드백을 제공합니다
- 기존 코드 스타일을 철저히 따르세요`,
    });

    const hollonReviewBot = hollonRepo.create({
      name: 'ReviewBot',
      organizationId: org.id,
      teamId: dogfoodingTeam.id,
      roleId: qaRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 1,
      systemPrompt: `당신은 ReviewBot입니다. 코드 리뷰와 품질 보증을 담당합니다.

특별 지침:
- 코드 품질, 타입 안전성, 에러 처리를 검토합니다
- 테스트 커버리지와 엣지 케이스를 확인합니다
- 건설적이고 구체적인 피드백을 제공합니다
- 보안 취약점이나 성능 문제를 식별합니다`,
    });

    await hollonRepo.save([hollonDogfood1, hollonDogfood2, hollonReviewBot]);
    console.log(
      `✅ Dogfooding Hollons created: ${hollonDogfood1.name}, ${hollonDogfood2.name}, ${hollonReviewBot.name}`,
    );

    // Dogfooding Project
    const dogfoodingProject = projectRepo.create({
      organizationId: org.id,
      name: 'Phase 2 Completion (Dogfooding)',
      description:
        'Hollon이 직접 Phase 2 미완성 항목을 구현 - 자기 자신을 개선하는 첫 단계',
      repositoryUrl: 'https://github.com/your-org/hollon-ai',
      workingDirectory: process.cwd(),
      status: ProjectStatus.ACTIVE,
    });
    await projectRepo.save(dogfoodingProject);
    console.log(
      `✅ Dogfooding Project created: ${dogfoodingProject.name} (${dogfoodingProject.id})`,
    );

    // ========================================
    // Phase 2 동시성 테스트용 태스크 3개
    // 각 태스크는 서로 다른 파일을 수정하여 충돌 없이 병렬 실행 가능
    // ========================================

    // Task 1: CollaborationService 개선 (DevBot-1용)
    const task1Collab = taskRepo.create({
      projectId: dogfoodingProject.id,
      title: 'CollaborationService의 findSuitableCollaborator 개선',
      description: `## 목표
CollaborationService의 findSuitableCollaborator 메서드를 개선하여 역할과 스킬 기반으로 협력자를 매칭합니다.

## 위치
파일: \`src/modules/collaboration/services/collaboration.service.ts\`

## 현재 문제
현재 구현은 단순히 첫 번째 가용 홀론을 선택합니다:
\`\`\`typescript
// 단순하게 첫 번째 가용 홀론 선택
// TODO: 역할, 스킬, 가용성 기반으로 매칭 개선
return availableHollons[0];
\`\`\`

## 개선 사항
1. 요청된 협업 유형(type)에 맞는 역할(Role)을 가진 홀론 우선 선택
2. 같은 팀 내 홀론 우선
3. 요청자와 같은 홀론은 제외

## 구현할 로직
\`\`\`typescript
private async findSuitableCollaborator(
  request: CollaborationRequestDto,
): Promise<Hollon | null> {
  // 1. 가용한 홀론 조회 (IDLE 상태)
  const availableHollons = await this.hollonRepo.find({
    where: { status: HollonStatus.IDLE },
    relations: ['role', 'team'],
  });

  if (availableHollons.length === 0) {
    this.logger.warn('No available hollons for collaboration');
    return null;
  }

  // 2. 협업 유형에 따른 우선순위 정렬
  const prioritized = availableHollons.sort((a, b) => {
    // code_review, pair_programming은 같은 역할 선호
    // knowledge_sharing은 다른 역할 선호
    let scoreA = 0;
    let scoreB = 0;

    // 같은 팀이면 +10점
    if (request.preferredTeamId && a.teamId === request.preferredTeamId) scoreA += 10;
    if (request.preferredTeamId && b.teamId === request.preferredTeamId) scoreB += 10;

    return scoreB - scoreA;
  });

  return prioritized[0];
}
\`\`\`

## 완료 기준
- TypeScript 컴파일 에러 없음
- 기존 테스트 통과
- 우선순위 로직이 적용됨`,
      status: TaskStatus.READY,
      priority: TaskPriority.P2_HIGH,
      affectedFiles: [
        'src/modules/collaboration/services/collaboration.service.ts',
      ],
      assignedHollonId: hollonDogfood1.id,
    });

    // Task 2: CrossTeamCollaborationService 알림 연동 (DevBot-2용)
    const task2CrossTeam = taskRepo.create({
      projectId: dogfoodingProject.id,
      title: 'CrossTeamCollaborationService에 팀 알림 연동 추가',
      description: `## 목표
CrossTeamCollaborationService의 requestDependency 메서드에 MessageService를 통한 알림 기능을 추가합니다.

## 위치
파일: \`src/modules/cross-team-collaboration/services/cross-team-collaboration.service.ts\`

## 현재 문제
현재 구현은 TODO 주석만 있고 실제 알림이 발송되지 않습니다:
\`\`\`typescript
// 2. 대상 팀에게 알림 (팀 채널로 전송하거나 팀의 첫 번째 홀론에게 전송)
// TODO: 팀 리더 개념 추가 시 수정 필요
// 현재는 시스템 알림으로만 처리
\`\`\`

## 개선 사항
1. MessageService를 주입받아 사용
2. 대상 팀의 홀론들에게 메시지 발송
3. 적절한 MessageType 사용 (DELEGATION_REQUEST)

## 구현 단계
1. constructor에 MessageService, HollonRepository 주입 추가
2. 대상 팀의 홀론 목록 조회
3. 각 홀론에게 알림 메시지 발송

## 완료 기준
- TypeScript 컴파일 에러 없음
- Contract 생성 시 대상 팀 홀론들에게 메시지 발송
- 적절한 에러 핸들링`,
      status: TaskStatus.READY,
      priority: TaskPriority.P2_HIGH,
      affectedFiles: [
        'src/modules/cross-team-collaboration/services/cross-team-collaboration.service.ts',
      ],
      assignedHollonId: hollonDogfood2.id,
    });

    // Task 3: Unit Test 작성 (ReviewBot용)
    const task3Test = taskRepo.create({
      projectId: dogfoodingProject.id,
      title: 'CollaborationService Unit Test 작성',
      description: `## 목표
CollaborationService에 대한 단위 테스트를 작성합니다.

## 위치
새 파일: \`src/modules/collaboration/services/collaboration.service.spec.ts\`

## 테스트 케이스
1. requestCollaboration
   - 협력자가 있을 때 세션 생성 성공
   - 가용한 협력자가 없을 때 처리

2. acceptCollaboration
   - 정상 수락 케이스
   - 존재하지 않는 세션 에러

3. startSession
   - 세션 상태가 ACTIVE로 변경되는지 확인

4. completeSession
   - 세션 완료 처리 확인

## 테스트 구조
\`\`\`typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CollaborationService } from './collaboration.service';
import { CollaborationSession } from '../entities/collaboration-session.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { MessageService } from '../../message/message.service';

describe('CollaborationService', () => {
  let service: CollaborationService;
  // ... mock repositories and services

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationService,
        // ... mock providers
      ],
    }).compile();

    service = module.get<CollaborationService>(CollaborationService);
  });

  describe('requestCollaboration', () => {
    it('should create a collaboration session', async () => {
      // ... test implementation
    });
  });
});
\`\`\`

## 완료 기준
- 테스트 파일이 올바른 위치에 생성됨
- npm test 실행 시 테스트 통과
- 주요 메서드에 대한 테스트 커버리지`,
      status: TaskStatus.READY,
      priority: TaskPriority.P3_MEDIUM,
      affectedFiles: [
        'src/modules/collaboration/services/collaboration.service.spec.ts',
      ],
      assignedHollonId: hollonReviewBot.id,
    });

    await taskRepo.save([task1Collab, task2CrossTeam, task3Test]);
    console.log(`✅ Phase 2 Concurrency Test Tasks created:`);
    console.log(`   - Task 1 (DevBot-1): ${task1Collab.title}`);
    console.log(`   - Task 2 (DevBot-2): ${task2CrossTeam.title}`);
    console.log(`   - Task 3 (ReviewBot): ${task3Test.title}`);

    // ========================================
    // 🚀 PHASE 4: Knowledge System Team
    // ========================================
    console.log('\n🚀 Creating Phase 4 Knowledge System Team...');

    // Phase 4 Team
    const phase4Team = teamRepo.create({
      organizationId: org.id,
      name: 'Phase 4 Knowledge Team',
      description:
        '지식 시스템 및 자기 개선 - Knowledge Extraction, Vector RAG, Self-Improvement',
    });
    await teamRepo.save(phase4Team);
    console.log(`✅ Phase 4 Team created: ${phase4Team.name}`);

    // Phase 4 Manager Hollon
    const phase4Manager = hollonRepo.create({
      name: 'Manager-Knowledge',
      organizationId: org.id,
      teamId: phase4Team.id,
      roleId: managerRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 1,
      systemPrompt: `당신은 Manager-Knowledge입니다. Phase 4 Knowledge Team의 매니저입니다.

특별 지침:
- Team Task를 받으면 AI/ML 및 Data Engineering 팀원들에게 효율적으로 분배
- DevBot-AI: NLP, Embedding, Vector search 관련 Task
- DevBot-Data: Graph, Database, Data modeling 관련 Task
- DevBot-Backend: 백엔드 통합 및 Self-Improvement Task
- ReviewBot-QA: 테스트 및 품질 검증
- 각 팀원의 전문성과 현재 워크로드를 고려하여 분배
- Vector search와 Knowledge graph는 병렬 개발 가능`,
    });

    await hollonRepo.save(phase4Manager);

    // Assign Manager to Phase 4 Team
    await teamRepo.update(phase4Team.id, {
      managerHollonId: phase4Manager.id,
    });
    console.log(
      `✅ Phase 4 Manager created and assigned: ${phase4Manager.name} → ${phase4Team.name}`,
    );

    // Phase 4 Hollons
    const devBotAI = hollonRepo.create({
      name: 'DevBot-AI',
      organizationId: org.id,
      teamId: phase4Team.id,
      roleId: aiEngineerRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 1,
      systemPrompt: `당신은 DevBot-AI입니다. AI/ML 전문 엔지니어로 Phase 4 Knowledge System을 구현합니다.

전문 분야:
- NLP 및 Text Processing
- OpenAI Embedding API 연동
- Vector similarity search 알고리즘
- Knowledge extraction 로직
- pgvector 최적화

프로젝트 컨텍스트:
- Hollon-AI 시스템의 지식 관리 모듈 구현
- Task 완료 후 자동으로 Document 생성
- Vector RAG를 통한 지식 검색 및 활용
- 기존 DocumentService와 통합`,
    });

    const devBotData = hollonRepo.create({
      name: 'DevBot-Data',
      organizationId: org.id,
      teamId: phase4Team.id,
      roleId: dataEngineerRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 1,
      systemPrompt: `당신은 DevBot-Data입니다. 데이터 엔지니어로 Phase 4 Knowledge Graph를 구현합니다.

전문 분야:
- Knowledge Graph 설계 및 구현
- Document relationships 모델링
- Graph traversal 알고리즘
- PostgreSQL 데이터베이스 최적화
- 성능 분석 및 인덱스 튜닝

프로젝트 컨텍스트:
- Document 간 관계 추적 (references, depends_on, related_to)
- Graph 기반 컨텍스트 확장
- 기존 Document Entity와 통합`,
    });

    const devBotBackend = hollonRepo.create({
      name: 'DevBot-Backend',
      organizationId: org.id,
      teamId: phase4Team.id,
      roleId: backendRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 1,
      systemPrompt: `당신은 DevBot-Backend입니다. 백엔드 엔지니어로 Phase 4 Self-Improvement 시스템을 구현합니다.

전문 분야:
- NestJS 서비스 아키텍처
- 성과 분석 시스템 (PerformanceAnalyzer)
- Prompt 최적화 로직 (PromptOptimizer)
- 베스트 프랙티스 추출 (BestPracticeService)
- TypeORM 통합

프로젝트 컨텍스트:
- Hollon 성과 메트릭 수집 및 분석
- Prompt 효과 분석 및 최적화 제안
- 고성과 패턴 추출 및 문서화`,
    });

    const reviewBotQA = hollonRepo.create({
      name: 'ReviewBot-QA',
      organizationId: org.id,
      teamId: phase4Team.id,
      roleId: qaRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 1,
      systemPrompt: `당신은 ReviewBot-QA입니다. Phase 4 Knowledge System의 QA 전문가입니다.

특별 지침:
- Knowledge Extraction 테스트 (자동 Document 생성 검증)
- Vector Search 정확도 측정 (85%+ 목표)
- Performance Analyzer 메트릭 검증
- Prompt Optimizer 효과 측정
- 통합 테스트 시나리오 작성
- Code Coverage 90%+ 유지`,
    });

    await hollonRepo.save([devBotAI, devBotData, devBotBackend, reviewBotQA]);
    console.log(
      `✅ Phase 4 Hollons created: ${devBotAI.name}, ${devBotData.name}, ${devBotBackend.name}, ${reviewBotQA.name}`,
    );

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Organization: ${org.name}`);
    console.log(
      `   Roles: 6 (Backend, Frontend, QA, Manager, AIEngineer, DataEngineer)`,
    );
    console.log(
      `   Teams: 3 (Core Development, Dogfooding Team, Phase 4 Knowledge Team)`,
    );
    console.log(
      `   Hollons: 10 (Alpha, Beta, Manager-Dogfood, DevBot-1, DevBot-2, ReviewBot, Manager-Knowledge, DevBot-AI, DevBot-Data, DevBot-Backend, ReviewBot-QA)`,
    );
    console.log(`   Projects: 2 (Phase 1 MVP, Phase 2 Dogfooding)`);
    console.log(`   Tasks: 6 (3 Phase 1 + 3 Concurrency Test)`);
    console.log('\n🐕 Dogfooding Phase 2 - Concurrency Test Setup:');
    console.log(
      `   Team: ${dogfoodingTeam.name} (Manager: ${managerHollon.name})`,
    );
    console.log(`   Hollons:`);
    console.log(
      `     - ${hollonDogfood1.name} (BackendEngineer) → Task: CollaborationService 개선`,
    );
    console.log(
      `     - ${hollonDogfood2.name} (BackendEngineer) → Task: CrossTeamCollaboration 알림`,
    );
    console.log(
      `     - ${hollonReviewBot.name} (QAEngineer) → Task: Unit Test 작성`,
    );
    console.log(`   Project: ${dogfoodingProject.name}`);
    console.log('\n🚀 Phase 4 Knowledge System Setup:');
    console.log(`   Team: ${phase4Team.name} (Manager: ${phase4Manager.name})`);
    console.log(`   Hollons:`);
    console.log(`     - ${devBotAI.name} (AIEngineer) → NLP, Vector Search`);
    console.log(`     - ${devBotData.name} (DataEngineer) → Knowledge Graph`);
    console.log(
      `     - ${devBotBackend.name} (BackendEngineer) → Self-Improvement`,
    );
    console.log(`     - ${reviewBotQA.name} (QAEngineer) → Testing & QA`);
    console.log('\n💡 Next steps:');
    console.log('   1. Start the server: pnpm --filter @hollon-ai/server dev');
    console.log(
      '   2. Create Phase 4 Goal: curl -X POST http://localhost:3001/goals ...',
    );
    console.log(
      '   3. Decompose Goal with useTeamDistribution: true (Manager auto-distributes)',
    );
    console.log('   4. Monitor autonomous execution (HollonExecutionService)');
    console.log('   5. Managers will auto-distribute Team Tasks to members\n');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

// Run seed
seed()
  .then(() => {
    console.log('✨ Seed completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seed failed:', error);
    process.exit(1);
  });
