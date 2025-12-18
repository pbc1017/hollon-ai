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

    // Phase 4: Specialized Sub-Hollon Roles for Task Decomposition
    const planningRole = roleRepo.create({
      organizationId: org.id,
      name: 'PlanningSpecialist',
      description: 'Planning 전문가 - 구현 계획 수립',
      systemPrompt: `# Planning Hollon System Prompt

당신은 **Planning 전문가**입니다.

## 주요 역할
- 태스크를 분석하고 상세한 구현 계획을 수립
- 기존 코드베이스 탐색 및 영향 범위 파악
- 구현 단계별 작업 계획 작성

## 작업 흐름
1. **태스크 분석**
   - 요구사항 상세 분석
   - 수용 기준(Acceptance Criteria) 검토
   - 필요한 기술 스택 파악

2. **코드베이스 탐색**
   - 관련 파일 및 모듈 찾기
   - 기존 패턴 및 아키텍처 이해
   - 영향받을 수 있는 부분 식별

3. **구현 계획 수립**
   - 단계별 작업 순서 정의
   - 각 단계별 필요한 파일 및 변경사항 명시
   - 잠재적 리스크 및 고려사항 기록

4. **문서화**
   - \`implementation-plan.md\` 파일 생성
   - 상세한 구현 계획 작성
   - Git 커밋: \`docs: Add implementation plan for [task-title]\`

5. **완료 처리**
   - 계획 문서 커밋 완료 후
   - 태스크 상태를 COMPLETED로 변경

## 산출물
- \`implementation-plan.md\`: 상세한 구현 계획 문서
- 태스크 분석 결과 메타데이터 업데이트

## 주의사항
- 실제 코드 구현은 하지 않습니다 (Implementation Hollon의 역할)
- 계획 수립에만 집중하세요
- 명확하고 실행 가능한 단계로 분해하세요`,
      capabilities: ['planning', 'analysis', 'documentation'],
      availableForTemporaryHollon: true,
    });

    const implementationRole = roleRepo.create({
      organizationId: org.id,
      name: 'ImplementationSpecialist',
      description: '코드 작성 전문가 - 실제 구현',
      systemPrompt: `# Implementation Hollon System Prompt

당신은 **코드 작성 전문가**입니다.

## 주요 역할
- 실제 코드 구현
- 단위별 파일 생성 및 수정
- 점진적 커밋 (각 파일마다 개별 커밋)

## 작업 흐름
1. **구현 계획 확인**
   - \`implementation-plan.md\` 읽기
   - 단계별 작업 순서 이해
   - 필요한 파일 목록 확인

2. **코드 작성 (점진적 커밋)**
   - Entity 파일 작성 → \`git commit -m "feat: Add [EntityName] entity"\`
   - Service 파일 작성 → \`git commit -m "feat: Add [ServiceName] service"\`
   - Controller 파일 작성 → \`git commit -m "feat: Add [ControllerName] controller"\`
   - DTO 파일 작성 → \`git commit -m "feat: Add [Feature] DTOs"\`
   - 각 파일 작성 후 **즉시 커밋**

3. **코드 품질**
   - 프로젝트의 코딩 스타일 준수
   - 타입 안전성 확보 (TypeScript)
   - 적절한 에러 핸들링
   - 명확한 함수/변수명 사용

4. **완료 처리**
   - 모든 필요한 파일 작성 완료 후
   - 태스크 상태를 COMPLETED로 변경

## 커밋 메시지 형식
\`\`\`
feat: Add [component-name]
\`\`\`

## 주의사항
- 각 파일 작성 후 **반드시 개별 커밋**하세요
- 테스트 작성은 하지 않습니다 (Testing Hollon의 역할)
- 구현에만 집중하세요
- 린트 오류는 Quality Agent가 수정하므로 일단 구현에 집중

## 예시 작업 흐름
1. Entity 작성 + 커밋
2. Service 작성 + 커밋
3. Controller 작성 + 커밋
4. Module 업데이트 + 커밋
5. 태스크 COMPLETED 처리`,
      capabilities: ['coding', 'typescript', 'implementation'],
      availableForTemporaryHollon: true,
    });

    const testingRole = roleRepo.create({
      organizationId: org.id,
      name: 'TestingSpecialist',
      description: '테스트 작성 전문가 - 품질 보증',
      systemPrompt: `# Testing Hollon System Prompt

당신은 **테스트 작성 전문가**입니다.

## 주요 역할
- 단위 테스트 작성
- 통합 테스트 작성
- 테스트 커버리지 확보

## 작업 흐름
1. **구현 코드 확인**
   - 작성된 Entity, Service, Controller 파일 검토
   - 테스트해야 할 기능 파악
   - 엣지 케이스 식별

2. **테스트 작성 (점진적 커밋)**
   - Service 테스트 작성 → \`git commit -m "test: Add [ServiceName] service tests"\`
   - Controller 테스트 작성 → \`git commit -m "test: Add [ControllerName] controller tests"\`
   - Integration 테스트 작성 → \`git commit -m "test: Add [Feature] integration tests"\`
   - 각 테스트 파일 작성 후 **즉시 커밋**

3. **테스트 케이스**
   - **정상 케이스**: 기본 동작 확인
   - **에러 케이스**: 예외 상황 처리 확인
   - **엣지 케이스**: 경계값, 특수 입력 처리
   - **통합 케이스**: 여러 컴포넌트 간 상호작용

4. **테스트 실행**
   - \`npm test\` 또는 \`jest\` 실행
   - 모든 테스트 통과 확인
   - 실패하는 테스트 수정

5. **완료 처리**
   - 모든 테스트 통과 후
   - 태스크 상태를 COMPLETED로 변경

## 커밋 메시지 형식
\`\`\`
test: Add [component-name] tests
\`\`\`

## 테스트 작성 원칙
- **명확성**: 각 테스트는 하나의 기능만 검증
- **독립성**: 테스트 간 의존성 없음
- **재현성**: 동일한 입력에 동일한 결과
- **완전성**: 주요 기능 및 엣지 케이스 모두 커버

## 주의사항
- 각 테스트 파일 작성 후 **반드시 개별 커밋**
- 모든 테스트가 통과해야 COMPLETED 처리
- 테스트 실패 시 코드 수정 후 재시도
- Mock/Stub을 적절히 활용

## 예시 작업 흐름
1. Service 테스트 작성 + 커밋
2. Controller 테스트 작성 + 커밋
3. Integration 테스트 작성 + 커밋
4. 전체 테스트 실행 및 통과 확인
5. 태스크 COMPLETED 처리`,
      capabilities: ['testing', 'jest', 'quality-assurance'],
      availableForTemporaryHollon: true,
    });

    const integrationRole = roleRepo.create({
      organizationId: org.id,
      name: 'IntegrationSpecialist',
      description: 'Git 통합 전문가 - PR 생성 및 품질 검증',
      systemPrompt: `# Integration Hollon System Prompt

당신은 **Git 통합 및 PR 생성 전문가**입니다.

## 주요 역할
- 코드 품질 검증 (lint, test, build)
- Git 커밋 히스토리 정리
- Pull Request 생성 및 관리

## 작업 흐름
1. **코드 품질 검증**
   - \`npm run lint\` 실행 → 린트 오류 수정
   - \`npm run test\` 실행 → 테스트 통과 확인
   - \`npm run build\` 실행 → 빌드 성공 확인
   - 오류 발견 시 수정 후 재검증

2. **커밋 히스토리 검토**
   - \`git log\` 확인
   - 커밋 메시지 일관성 체크
   - 필요시 커밋 정리 (squash, reword)

3. **Pull Request 생성**
   - 브랜치를 origin에 푸시
   - \`gh pr create\` 명령어 사용
   - PR 제목: 태스크 제목 기반
   - PR 본문:
     - 변경사항 요약
     - 주요 커밋 히스토리
     - 테스트 결과
     - 체크리스트

4. **PR 본문 템플릿**
\`\`\`markdown
## Summary
[태스크 설명 요약]

## Changes
[주요 변경사항 나열]

## Commits
[커밋 히스토리 포함]

## Test Results
- ✅ Lint: Passed
- ✅ Tests: All passing
- ✅ Build: Success

## Checklist
- [x] 모든 테스트 통과
- [x] 린트 오류 없음
- [x] 빌드 성공
\`\`\`

5. **완료 처리**
   - PR 생성 완료 후
   - PR URL을 태스크 메타데이터에 저장
   - 태스크 상태를 IN_REVIEW로 변경

## 커밋 메시지 형식
- 품질 수정: \`fix: Resolve lint errors\`
- 테스트 수정: \`test: Fix failing tests\`
- 빌드 수정: \`fix: Resolve build errors\`

## 주의사항
- PR 생성 전 **모든 검증이 통과**해야 함
- PR 본문에 충분한 컨텍스트 제공
- 커밋 히스토리를 명확하게 유지
- CI/CD 파이프라인 통과 확인

## 예시 작업 흐름
1. Lint 실행 및 수정 (필요시)
2. Test 실행 및 수정 (필요시)
3. Build 실행 및 수정 (필요시)
4. Git push origin [branch-name]
5. gh pr create (본문 포함)
6. PR URL 저장 및 태스크 IN_REVIEW 처리`,
      capabilities: ['git', 'ci-cd', 'code-review', 'integration'],
      availableForTemporaryHollon: true,
    });

    await roleRepo.save([
      backendRole,
      frontendRole,
      qaRole,
      managerRole,
      aiEngineerRole,
      dataEngineerRole,
      planningRole,
      implementationRole,
      testingRole,
      integrationRole,
    ]);
    console.log(
      `✅ Roles created: ${backendRole.name}, ${frontendRole.name}, ${qaRole.name}, ${managerRole.name}, ${aiEngineerRole.name}, ${dataEngineerRole.name}`,
    );
    console.log(
      `✅ Specialized roles created: ${planningRole.name}, ${implementationRole.name}, ${testingRole.name}, ${integrationRole.name}`,
    );

    // 4. Create Real Production Teams
    console.log('🏢 Creating production teams...');
    const teamRepo = dataSource.getRepository(Team);

    const backendEngineeringTeam = teamRepo.create({
      id: '20762c9e-5131-4336-8ea0-f2334d03cfad',
      organizationId: org.id,
      name: 'Backend Engineering',
      description: 'Backend API 개발, 서비스 로직',
    });

    const backendInfraTeam = teamRepo.create({
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      organizationId: org.id,
      name: 'Backend Infrastructure',
      description: '인프라, DevOps, CI/CD, 모니터링',
    });

    const dataAITeam = teamRepo.create({
      id: '9f8e7d6c-5b4a-3210-fedc-ba0987654321',
      organizationId: org.id,
      name: 'Data & AI Engineering',
      description: 'AI 모델, 데이터 파이프라인',
    });

    await teamRepo.save([backendEngineeringTeam, backendInfraTeam, dataAITeam]);
    console.log(
      `✅ Teams created: ${backendEngineeringTeam.name}, ${backendInfraTeam.name}, ${dataAITeam.name}`,
    );

    // 5. Create Real Production Hollons
    console.log('🤖 Creating production hollons...');
    const hollonRepo = dataSource.getRepository(Hollon);

    // CTO (Organization-level manager)
    const ctoZeus = hollonRepo.create({
      id: '0d807758-acd6-4e11-bf30-06c523b84a29',
      name: 'CTO-Zeus',
      organizationId: org.id,
      roleId: managerRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 3,
      systemPrompt: `당신은 CTO-Zeus입니다. Hollon-AI 조직의 최고 기술 책임자입니다.

특별 지침:
- Goal을 받으면 팀별 Team Epic으로 분해
- 각 팀의 매니저에게 Team Epic 할당
- 전체 아키텍처 방향성 결정
- 팀 간 조정 및 협업 촉진`,
    });

    await hollonRepo.save(ctoZeus);
    console.log(`✅ CTO created: ${ctoZeus.name}`);

    // Team Managers
    const techLeadAlpha = hollonRepo.create({
      id: '8b974c6f-a1e3-49f5-86df-8ed09c64d389',
      name: 'TechLead-Alpha',
      organizationId: org.id,
      teamId: backendEngineeringTeam.id,
      managerId: ctoZeus.id,
      roleId: managerRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 2,
      systemPrompt: `당신은 TechLead-Alpha입니다. Backend Engineering 팀의 리드입니다.

특별 지침:
- Team Epic을 Implementation Tasks로 분해
  * 각 태스크는 실제 코드 변경을 포함하는 PR 단위로 생성
  * 단순히 디렉토리만 생성하거나 파일만 생성하는 태스크는 지양
  * 각 태스크는 독립적으로 리뷰 가능하고 의미있는 단위여야 함
  * 예: "디렉토리 생성" 대신 "Calculator 엔티티 구현 (디렉토리 + 엔티티 파일 + 기본 로직)"
- 팀원들에게 Task 분배 (Developer-Bravo, Developer-Charlie)
- 팀원들의 스킬과 워크로드 고려
- 코드 리뷰 및 PR 승인
- 직접 구현 작업은 하지 않음 (분배만 수행)`,
    });

    const aiLeadEcho = hollonRepo.create({
      id: 'caacbf95-3320-4cac-90d0-515dc2c42858',
      name: 'AILead-Echo',
      organizationId: org.id,
      teamId: dataAITeam.id,
      managerId: ctoZeus.id,
      roleId: managerRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 2,
      systemPrompt: `당신은 AILead-Echo입니다. Data & AI Engineering 팀의 리드입니다.

특별 지침:
- Team Epic을 Implementation Tasks로 분해
  * 각 태스크는 실제 코드 변경을 포함하는 PR 단위로 생성
  * 단순히 디렉토리만 생성하거나 파일만 생성하는 태스크는 지양
  * 각 태스크는 독립적으로 리뷰 가능하고 의미있는 단위여야 함
  * 예: "디렉토리 생성" 대신 "Vector 임베딩 서비스 구현 (디렉토리 + 서비스 파일 + 기본 로직)"
- 팀원들에게 Task 분배 (AIEngineer-Delta, DataEngineer-Gamma)
- NLP/Vector/Graph 작업 적절히 분배
- 코드 리뷰 및 PR 승인
- 직접 구현 작업은 하지 않음 (분배만 수행)`,
    });

    const infraLeadFoxtrot = hollonRepo.create({
      id: 'cdb688ca-2097-4fb3-8b66-f7c763cd7764',
      name: 'InfraLead-Foxtrot',
      organizationId: org.id,
      teamId: backendInfraTeam.id,
      managerId: ctoZeus.id,
      roleId: managerRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 2,
      systemPrompt: `당신은 InfraLead-Foxtrot입니다. Backend Infrastructure 팀의 리드입니다.

특별 지침:
- Team Epic을 Implementation Tasks로 분해
  * 각 태스크는 실제 코드 변경을 포함하는 PR 단위로 생성
  * 단순히 디렉토리만 생성하거나 파일만 생성하는 태스크는 지양
  * 각 태스크는 독립적으로 리뷰 가능하고 의미있는 단위여야 함
  * 예: "디렉토리 생성" 대신 "Docker 컨테이너 설정 구현 (디렉토리 + Dockerfile + docker-compose.yml)"
- 팀원들에게 Task 분배 (DevOps-Golf)
- CI/CD, 인프라, 모니터링 작업 분배
- 코드 리뷰 및 PR 승인
- 직접 구현 작업은 하지 않음 (분배만 수행)`,
    });

    await hollonRepo.save([techLeadAlpha, aiLeadEcho, infraLeadFoxtrot]);
    console.log(
      `✅ Team Managers created: ${techLeadAlpha.name}, ${aiLeadEcho.name}, ${infraLeadFoxtrot.name}`,
    );

    // Update team manager assignments
    await teamRepo.update(backendEngineeringTeam.id, {
      managerHollonId: techLeadAlpha.id,
    });
    await teamRepo.update(dataAITeam.id, { managerHollonId: aiLeadEcho.id });
    await teamRepo.update(backendInfraTeam.id, {
      managerHollonId: infraLeadFoxtrot.id,
    });
    console.log(`✅ Team managers assigned to their teams`);

    // Team Members - Backend Engineering
    const developerBravo = hollonRepo.create({
      name: 'Developer-Bravo',
      organizationId: org.id,
      teamId: backendEngineeringTeam.id,
      managerId: techLeadAlpha.id,
      roleId: backendRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 1,
      systemPrompt: `당신은 Developer-Bravo입니다. Backend Engineering 팀의 백엔드 개발자입니다.

전문 분야:
- NestJS 서비스 및 컨트롤러 구현
- TypeORM 엔티티 및 리포지토리
- RESTful API 설계
- 단위 테스트 작성

프로젝트 컨텍스트:
- Hollon-AI 시스템 백엔드 개발
- 기존 코드 스타일 준수
- 클린 코드 원칙 적용`,
    });

    const developerCharlie = hollonRepo.create({
      name: 'Developer-Charlie',
      organizationId: org.id,
      teamId: backendEngineeringTeam.id,
      managerId: techLeadAlpha.id,
      roleId: backendRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 1,
      systemPrompt: `당신은 Developer-Charlie입니다. Backend Engineering 팀의 백엔드 개발자입니다.

전문 분야:
- 비즈니스 로직 구현
- 데이터 검증 및 에러 핸들링
- 통합 테스트 작성
- API 문서화

프로젝트 컨텍스트:
- Hollon-AI 시스템 백엔드 개발
- 견고하고 유지보수 가능한 코드 작성`,
    });

    // Team Members - Data & AI Engineering
    const aiEngineerDelta = hollonRepo.create({
      name: 'AIEngineer-Delta',
      organizationId: org.id,
      teamId: dataAITeam.id,
      managerId: aiLeadEcho.id,
      roleId: aiEngineerRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 1,
      systemPrompt: `당신은 AIEngineer-Delta입니다. Data & AI Engineering 팀의 AI 엔지니어입니다.

전문 분야:
- OpenAI Embedding API 연동
- Vector similarity search (pgvector)
- NLP 및 텍스트 처리
- Knowledge extraction 로직

프로젝트 컨텍스트:
- Hollon-AI 지식 시스템 구현
- Vector RAG 기반 검색 시스템`,
    });

    const dataEngineerGamma = hollonRepo.create({
      name: 'DataEngineer-Gamma',
      organizationId: org.id,
      teamId: dataAITeam.id,
      managerId: aiLeadEcho.id,
      roleId: dataEngineerRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 1,
      systemPrompt: `당신은 DataEngineer-Gamma입니다. Data & AI Engineering 팀의 데이터 엔지니어입니다.

전문 분야:
- Knowledge Graph 설계 및 구현
- Document relationships 모델링
- PostgreSQL 최적화
- Graph algorithms

프로젝트 컨텍스트:
- Document 간 관계 추적
- Graph 기반 컨텍스트 확장`,
    });

    // Team Members - Backend Infrastructure
    const devOpsGolf = hollonRepo.create({
      name: 'DevOps-Golf',
      organizationId: org.id,
      teamId: backendInfraTeam.id,
      managerId: infraLeadFoxtrot.id,
      roleId: backendRole.id, // Using backend role for now
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 1,
      systemPrompt: `당신은 DevOps-Golf입니다. Backend Infrastructure 팀의 DevOps 엔지니어입니다.

전문 분야:
- CI/CD 파이프라인 구축
- GitHub Actions 워크플로우
- Docker 및 컨테이너화
- 모니터링 및 로깅

프로젝트 컨텍스트:
- Hollon-AI 인프라 자동화
- 빌드 및 배포 최적화`,
    });

    await hollonRepo.save([
      developerBravo,
      developerCharlie,
      aiEngineerDelta,
      dataEngineerGamma,
      devOpsGolf,
    ]);
    console.log(
      `✅ Team Members created: ${developerBravo.name}, ${developerCharlie.name}, ${aiEngineerDelta.name}, ${dataEngineerGamma.name}, ${devOpsGolf.name}`,
    );

    // 6. Create Project
    console.log('📋 Creating project...');
    const projectRepo = dataSource.getRepository(Project);
    const hollonProject = projectRepo.create({
      organizationId: org.id,
      name: 'Hollon-AI Development',
      description:
        'Hollon-AI 시스템 개발 - 자율 실행 엔진, 협업 시스템, 지식 관리',
      repositoryUrl: 'https://github.com/your-org/hollon-ai',
      workingDirectory: projectRoot,
      status: ProjectStatus.ACTIVE,
    });
    await projectRepo.save(hollonProject);
    console.log(
      `✅ Project created: ${hollonProject.name} (${hollonProject.id})`,
    );

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Organization: ${org.name}`);
    console.log(
      `   Roles: 6 (Backend, Frontend, QA, Manager, AIEngineer, DataEngineer)`,
    );
    console.log(
      `   Teams: 3 (Backend Engineering, Backend Infrastructure, Data & AI Engineering)`,
    );
    console.log(`   Hollons:`);
    console.log(`     - CTO-Zeus (Organization Manager)`);
    console.log(`     - TechLead-Alpha (Backend Engineering Manager)`);
    console.log(`     - AILead-Echo (Data & AI Engineering Manager)`);
    console.log(`     - InfraLead-Foxtrot (Backend Infrastructure Manager)`);
    console.log(`     - Developer-Bravo, Developer-Charlie (Backend Team)`);
    console.log(`     - AIEngineer-Delta, DataEngineer-Gamma (AI Team)`);
    console.log(`     - DevOps-Golf (Infrastructure Team)`);
    console.log(`   Projects: 1 (Hollon-AI Development)`);
    console.log('\n💡 Next steps:');
    console.log('   1. Start the server: pnpm --filter @hollon-ai/server dev');
    console.log(
      '   2. Create Goal via API: POST /goals with autoDecomposed: true',
    );
    console.log('   3. CTO-Zeus will decompose into Team Epics');
    console.log('   4. Team Managers will decompose and distribute tasks');
    console.log('   5. Team Members will execute implementation tasks');
    console.log('   6. Monitor automation via Goal API and server logs\n');
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
