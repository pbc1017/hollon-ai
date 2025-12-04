import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join, resolve } from 'path';
import { Organization } from '../modules/organization/entities/organization.entity';
import { Role } from '../modules/role/entities/role.entity';
import { Team } from '../modules/team/entities/team.entity';
import { Hollon, HollonStatus } from '../modules/hollon/entities/hollon.entity';
import { Project, ProjectStatus } from '../modules/project/entities/project.entity';
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
      capabilities: ['typescript', 'nestjs', 'postgresql', 'typeorm', 'rest-api'],
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
      capabilities: ['typescript', 'react', 'nextjs', 'tailwind', 'responsive-design'],
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

    await roleRepo.save([backendRole, frontendRole, qaRole]);
    console.log(`✅ Roles created: ${backendRole.name}, ${frontendRole.name}, ${qaRole.name}`);

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
      systemPrompt: '당신은 Alpha입니다. 백엔드 개발에 집중하며, 특히 API 엔드포인트와 비즈니스 로직 구현을 담당합니다.',
    });

    const hollonBeta = hollonRepo.create({
      name: 'Beta',
      organizationId: org.id,
      teamId: coreTeam.id,
      roleId: backendRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      maxConcurrentTasks: 1,
      systemPrompt: '당신은 Beta입니다. 백엔드 개발에 집중하며, 특히 데이터베이스 스키마와 엔티티 구현을 담당합니다.',
    });

    await hollonRepo.save([hollonAlpha, hollonBeta]);
    console.log(`✅ Hollons created: ${hollonAlpha.name}, ${hollonBeta.name}`);

    // 6. Create Project
    console.log('📋 Creating project...');
    const projectRepo = dataSource.getRepository(Project);
    const phase1Project = projectRepo.create({
      organizationId: org.id,
      name: 'Phase 1: MVP Core',
      description: '자율 실행 엔진 구현 - 홀론이 태스크를 Pull → 실행 → 완료하는 사이클',
      repositoryUrl: 'https://github.com/your-org/hollon-ai',
      workingDirectory: '/path/to/hollon-ai',
      status: ProjectStatus.ACTIVE,
    });
    await projectRepo.save(phase1Project);
    console.log(`✅ Project created: ${phase1Project.name} (${phase1Project.id})`);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Organization: ${org.name}`);
    console.log(`   Roles: 3 (Backend, Frontend, QA)`);
    console.log(`   Team: ${coreTeam.name}`);
    console.log(`   Hollons: 2 (Alpha, Beta)`);
    console.log(`   Project: ${phase1Project.name}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Create tasks for the project');
    console.log('   2. Start hollons to pull and execute tasks');
    console.log('   3. Monitor progress and costs\n');
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
