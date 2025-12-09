# Phase 3 통합 및 계층적 조직 구조 구현 계획

**작성일**: 2025-12-09
**목표**: DependencyAnalyzer/ResourcePlanner 통합 + 조직 계층 구조 구현
**선행 작업**: Dogfooding 2차 실험 성공

---

## 📋 Executive Summary

### 핵심 작업

1. **DependencyAnalyzer description 파싱 구현** (Critical)
2. **ResourcePlanner GoalDecomposition 통합** (Critical)
3. **계층적 Team/Hollon 구조 구현** (Important)
4. **Escalation 메커니즘 구현** (Important)

### 예상 소요 시간

- **총 3-4일** (1일 = 4-6시간 작업)
- Day 1-2: DependencyAnalyzer + ResourcePlanner
- Day 3: 계층 구조 + Escalation
- Day 4: 테스트 및 검증

---

## 🎯 현재 상태 분석

### ✅ 이미 구현된 것

1. **Team Entity** (apps/server/src/modules/team/entities/team.entity.ts)
   - ✅ 기본 Team 구조
   - ✅ Organization과의 관계
   - ✅ Hollon과의 OneToMany 관계
   - ❌ **Team 간 계층 구조 없음** (parentTeamId 미구현)

2. **Hollon Entity** (apps/server/src/modules/hollon/entities/hollon.entity.ts)
   - ✅ Team에 속함 (teamId)
   - ✅ Role 기반 권한
   - ✅ Status 관리 (IDLE, WORKING, BLOCKED 등)
   - ❌ **Hollon 간 계층 관계 없음** (managerId 미구현)
   - ❌ **Skill 정보 없음** (skills 컬럼 미구현)

3. **Role Entity**
   - ✅ 역할 템플릿 정의
   - ❌ **계층적 권한 레벨 없음** (level/rank 미구현)

4. **GoalDecompositionService**
   - ✅ LLM 기반 Task 자동 생성 (40개 성공)
   - ✅ Brain Provider 통합
   - ✅ Cost tracking
   - ❌ **DependencyAnalyzer 호출 안 함**
   - ❌ **ResourcePlanner 호출 안 함**

5. **DependencyAnalyzer**
   - ✅ 서비스 구현 완료
   - ✅ Graph 알고리즘 (위상 정렬, 순환 감지)
   - ❌ **description 파싱 미구현**
   - ❌ **task_dependencies 테이블 자동 채우기 안 함**

6. **ResourcePlanner**
   - ✅ 서비스 구현 완료
   - ✅ Skill 기반 매칭 로직
   - ❌ **Skill Matrix 없음** (Hollon.skills 컬럼 없음)
   - ❌ **GoalDecomposition 통합 안 됨**

### ❌ 구현 필요한 것

1. **계층적 Team 구조**
2. **계층적 Hollon 구조** (CTO → Tech Lead → Developer)
3. **Skill Matrix** (Hollon별 보유 스킬)
4. **Escalation 메커니즘** (Level 1-5)
5. **DependencyAnalyzer description 파싱**
6. **ResourcePlanner 통합**

---

## 🏗️ 아키텍처 설계

### 1. 계층적 조직 구조

#### SSOT 정의 (docs/ssot.md)

```
에스컬레이션 계층 (ssot.md Line 337-343):

Level 1: 자기 해결 (재시도, 대안 탐색)
    ↓ 실패 시
Level 2: 팀 내 협업 (같은 팀 홀론에게 도움 요청)
    ↓ 실패 시
Level 3: 팀 리더 에스컬레이션
    ↓ 실패 시
Level 4: 상위 팀 에스컬레이션
    ↓ 실패 시
Level 5: 인간 에스컬레이션
```

#### 제안하는 구조

```
Organization: "Hollon-AI Corp"
    │
    ├─ Team: "Engineering" (parentTeamId: null)  ← 최상위 팀
    │   │
    │   ├─ Hollon: "CTO" (managerId: null, roleLevel: 5)  ← 팀 리더
    │   │
    │   ├─ Team: "Backend Team" (parentTeamId: Engineering.id)
    │   │   │
    │   │   ├─ Hollon: "Tech Lead Backend" (managerId: CTO.id, roleLevel: 4)
    │   │   │
    │   │   ├─ Hollon: "Senior Backend Dev" (managerId: Tech Lead.id, roleLevel: 3)
    │   │   │
    │   │   └─ Hollon: "Backend Dev" (managerId: Senior Dev.id, roleLevel: 2)
    │   │
    │   └─ Team: "Frontend Team" (parentTeamId: Engineering.id)
    │       │
    │       ├─ Hollon: "Tech Lead Frontend" (managerId: CTO.id, roleLevel: 4)
    │       │
    │       └─ Hollon: "Frontend Dev" (managerId: Tech Lead.id, roleLevel: 2)
    │
    └─ Team: "Product" (parentTeamId: null)
        │
        └─ Hollon: "PM" (managerId: null, roleLevel: 5)
```

#### Escalation 흐름

```typescript
// Example: Backend Dev가 Task 실패 시

Level 1: 자기 해결 (Backend Dev)
  - retry_count < 3 → 재시도
  - 실패 → Level 2

Level 2: 팀 내 협업 (같은 Team의 다른 Hollon)
  - Backend Team에서 동료 검색
  - Senior Backend Dev에게 협업 요청
  - 2시간 내 미해결 → Level 3

Level 3: 직속 상사 (managerId)
  - Tech Lead Backend에게 에스컬레이션
  - 4시간 내 미해결 → Level 4

Level 4: 상위 팀 리더 (parent Team의 leader)
  - CTO에게 에스컬레이션
  - 8시간 내 미해결 → Level 5

Level 5: 인간
  - ApprovalRequest 생성
  - 알림 발송
  - 인간 개입 대기
```

---

## 📐 Database Schema 변경

### 1. Team Entity 확장

```typescript
// apps/server/src/modules/team/entities/team.entity.ts

@Entity('teams')
export class Team extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  // ✨ NEW: 계층 구조 지원
  @Column({ name: 'parent_team_id', type: 'uuid', nullable: true })
  parentTeamId: string | null;

  // ✨ NEW: 팀 리더 (선택적)
  @Column({ name: 'leader_hollon_id', type: 'uuid', nullable: true })
  leaderHollonId: string | null;

  // Relations
  @ManyToOne(() => Organization, (org) => org.teams, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // ✨ NEW: Self-referencing (parent team)
  @ManyToOne(() => Team, (team) => team.childTeams, { nullable: true })
  @JoinColumn({ name: 'parent_team_id' })
  parentTeam: Team | null;

  @OneToMany(() => Team, (team) => team.parentTeam)
  childTeams: Team[];

  // ✨ NEW: Team leader
  @ManyToOne(() => Hollon, { nullable: true })
  @JoinColumn({ name: 'leader_hollon_id' })
  leader: Hollon | null;

  @OneToMany(() => Hollon, (hollon) => hollon.team)
  hollons: Hollon[];
}
```

### 2. Hollon Entity 확장

```typescript
// apps/server/src/modules/hollon/entities/hollon.entity.ts

@Entity('hollons')
@Index(['organizationId', 'status'])
export class Hollon extends BaseEntity {
  // ... 기존 필드 ...

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @Column({ name: 'role_id' })
  roleId: string;

  // ✨ NEW: 직속 상사
  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId: string | null;

  // ✨ NEW: 스킬 배열 (PostgreSQL array)
  @Column({ type: 'text', array: true, default: '{}' })
  skills: string[];

  // ✨ NEW: 경험 레벨 (1-5: Junior-Senior)
  @Column({ name: 'experience_level', default: 3 })
  experienceLevel: number;

  // Relations
  @ManyToOne(() => Team, (team) => team.hollons, { nullable: true })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  @ManyToOne(() => Role, (role) => role.hollons)
  @JoinColumn({ name: 'role_id' })
  role: Role;

  // ✨ NEW: Self-referencing (manager)
  @ManyToOne(() => Hollon, (hollon) => hollon.subordinates, { nullable: true })
  @JoinColumn({ name: 'manager_id' })
  manager: Hollon | null;

  @OneToMany(() => Hollon, (hollon) => hollon.manager)
  subordinates: Hollon[];

  // ... 기존 Relations ...
}
```

### 3. Role Entity 확장

```typescript
// apps/server/src/modules/role/entities/role.entity.ts

@Entity('roles')
export class Role extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text' })
  systemPrompt: string;

  // ✨ NEW: 권한 레벨 (1-5)
  // 1: Junior Dev, 2: Mid Dev, 3: Senior Dev, 4: Tech Lead, 5: CTO/Director
  @Column({ name: 'authority_level', default: 2 })
  authorityLevel: number;

  // ✨ NEW: 자율성 레벨 (1-5)
  // 높을수록 더 많은 자율 결정 가능
  @Column({ name: 'autonomy_level', default: 2 })
  autonomyLevel: number;

  // ✨ NEW: 승인 권한 (예산, 아키텍처 결정 등)
  @Column({ type: 'jsonb', nullable: true })
  approvalPermissions: {
    budgetLimit?: number; // USD
    canApproveArchitecture?: boolean;
    canCreateTemporaryHollons?: boolean;
    canEscalateToHuman?: boolean;
  };

  // ... 기존 필드 ...
}
```

### 4. Migration 파일

```typescript
// apps/server/src/database/migrations/XXXXXX-HierarchicalOrganization.ts

export class HierarchicalOrganization1733XXXXXX implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Team 계층 구조
    await queryRunner.query(`
      ALTER TABLE "teams"
      ADD COLUMN "parent_team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
      ADD COLUMN "leader_hollon_id" uuid REFERENCES "hollons"("id") ON DELETE SET NULL;
    `);

    // 2. Hollon 계층 구조 + Skills
    await queryRunner.query(`
      ALTER TABLE "hollons"
      ADD COLUMN "manager_id" uuid REFERENCES "hollons"("id") ON DELETE SET NULL,
      ADD COLUMN "skills" text[] DEFAULT '{}',
      ADD COLUMN "experience_level" integer DEFAULT 3;
    `);

    // 3. Role 권한 레벨
    await queryRunner.query(`
      ALTER TABLE "roles"
      ADD COLUMN "authority_level" integer DEFAULT 2,
      ADD COLUMN "autonomy_level" integer DEFAULT 2,
      ADD COLUMN "approval_permissions" jsonb;
    `);

    // 4. Indexes for performance
    await queryRunner.query(`
      CREATE INDEX "IDX_team_parent" ON "teams"("parent_team_id");
      CREATE INDEX "IDX_hollon_manager" ON "hollons"("manager_id");
      CREATE INDEX "IDX_hollon_skills" ON "hollons" USING GIN("skills");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teams"
      DROP COLUMN "parent_team_id",
      DROP COLUMN "leader_hollon_id";

      ALTER TABLE "hollons"
      DROP COLUMN "manager_id",
      DROP COLUMN "skills",
      DROP COLUMN "experience_level";

      ALTER TABLE "roles"
      DROP COLUMN "authority_level",
      DROP COLUMN "autonomy_level",
      DROP COLUMN "approval_permissions";
    `);
  }
}
```

---

## 💻 서비스 구현

### 1. DependencyAnalyzer 파싱 구현

```typescript
// apps/server/src/modules/task/services/dependency-analyzer.service.ts

export class DependencyAnalyzer {
  /**
   * Task description에서 Dependencies 섹션을 파싱하여
   * task_dependencies 테이블에 관계 생성
   */
  async extractAndCreateDependencies(taskId: string): Promise<void> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    // description에서 **Dependencies:** 섹션 찾기
    const dependenciesMatch = task.description.match(
      /\*\*Dependencies:\*\*\n((?:- .+\n?)+)/,
    );

    if (!dependenciesMatch) {
      // Dependencies 없음 (정상)
      return;
    }

    // 각 dependency line 파싱
    const dependencyLines = dependenciesMatch[1]
      .split('\n')
      .filter((line) => line.trim().startsWith('-'))
      .map((line) => line.replace(/^-\s*/, '').trim());

    // Task title로 매칭하여 depends_on_id 찾기
    for (const depTitle of dependencyLines) {
      const dependsOnTask = await this.taskRepository.findOne({
        where: {
          title: Like(`%${depTitle}%`),
          projectId: task.projectId,
        },
      });

      if (dependsOnTask) {
        // task_dependencies 테이블에 관계 생성
        await this.taskDependencyRepository.insert({
          taskId: task.id,
          dependsOnId: dependsOnTask.id,
        });
      } else {
        this.logger.warn(
          `Dependency "${depTitle}" not found for task ${task.title}`,
        );
      }
    }
  }

  /**
   * GoalDecomposition 결과의 모든 Task에 대해 dependencies 추출
   */
  async analyzeDependencies(tasks: Task[]): Promise<void> {
    for (const task of tasks) {
      await this.extractAndCreateDependencies(task.id);
    }
  }
}
```

### 2. ResourcePlanner Skill 기반 할당

```typescript
// apps/server/src/modules/task/services/resource-planner.service.ts

export class ResourcePlanner {
  /**
   * Task 설명에서 필요 스킬 추출
   */
  private extractRequiredSkills(task: Task): string[] {
    const skillKeywords = {
      typescript: ['typescript', 'ts', 'type'],
      nestjs: ['nestjs', 'nest'],
      database: ['database', 'postgres', 'typeorm', 'migration'],
      testing: ['test', 'jest', 'e2e', 'unit test'],
      frontend: ['react', 'nextjs', 'ui', 'component'],
      api: ['api', 'endpoint', 'controller'],
      architecture: ['architecture', 'design', 'system'],
    };

    const description = task.description.toLowerCase();
    const title = task.title.toLowerCase();
    const text = `${title} ${description}`;

    const requiredSkills: string[] = [];
    for (const [skill, keywords] of Object.entries(skillKeywords)) {
      if (keywords.some((keyword) => text.includes(keyword))) {
        requiredSkills.push(skill);
      }
    }

    return requiredSkills;
  }

  /**
   * Skill 기반 최적 Hollon 찾기
   */
  async findBestHollon(
    task: Task,
    availableHollons: Hollon[],
  ): Promise<Hollon | null> {
    const requiredSkills = this.extractRequiredSkills(task);

    if (requiredSkills.length === 0) {
      // 스킬 요구사항 없음 → 가장 경험 많은 Hollon
      return (
        availableHollons.sort(
          (a, b) => b.experienceLevel - a.experienceLevel,
        )[0] || null
      );
    }

    // Skill 매칭 스코어 계산
    const scored = availableHollons.map((hollon) => {
      const matchCount = requiredSkills.filter((skill) =>
        hollon.skills.includes(skill),
      ).length;

      return {
        hollon,
        score: matchCount + hollon.experienceLevel * 0.5,
      };
    });

    // 최고 점수 Hollon 반환
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.hollon || null;
  }

  /**
   * Tasks에 Hollon 자동 할당
   */
  async assignHollons(tasks: Task[]): Promise<void> {
    // 사용 가능한 Hollon 목록
    const availableHollons = await this.hollonRepository.find({
      where: {
        status: HollonStatus.IDLE,
        lifecycle: HollonLifecycle.PERMANENT,
      },
      relations: ['team', 'role'],
    });

    for (const task of tasks) {
      const bestHollon = await this.findBestHollon(task, availableHollons);

      if (bestHollon) {
        task.assignedHollonId = bestHollon.id;
        await this.taskRepository.save(task);
      }
    }
  }
}
```

### 3. GoalDecompositionController 통합

```typescript
// apps/server/src/modules/goal/controllers/goal.controller.ts

@Controller('goals')
export class GoalController {
  constructor(
    private readonly goalDecompositionService: GoalDecompositionService,
    private readonly dependencyAnalyzer: DependencyAnalyzer,
    private readonly resourcePlanner: ResourcePlanner,
  ) {}

  @Post(':goalId/decompose')
  async decomposeGoal(
    @Param('goalId') goalId: string,
    @Body() dto: DecomposeGoalDto,
  ) {
    // 1. GoalDecompositionService 실행
    const result = await this.goalDecompositionService.decompose(
      goalId,
      dto.strategy || 'task_based',
    );

    // 2. DependencyAnalyzer 실행
    await this.dependencyAnalyzer.analyzeDependencies(result.tasks);

    // 3. ResourcePlanner 실행
    await this.resourcePlanner.assignHollons(result.tasks);

    return {
      ...result,
      dependenciesCreated: true,
      hollonsAssigned: true,
    };
  }
}
```

### 4. Escalation Service

```typescript
// apps/server/src/modules/escalation/services/escalation.service.ts

export enum EscalationLevel {
  SELF = 1,
  TEAM_PEER = 2,
  DIRECT_MANAGER = 3,
  UPPER_MANAGER = 4,
  HUMAN = 5,
}

export class EscalationService {
  /**
   * Task 실패 시 Escalation 실행
   */
  async escalate(
    taskId: string,
    hollonId: string,
    level: EscalationLevel,
  ): Promise<void> {
    const hollon = await this.hollonRepository.findOne({
      where: { id: hollonId },
      relations: ['team', 'manager', 'team.leader', 'team.parentTeam'],
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    switch (level) {
      case EscalationLevel.SELF:
        // 재시도
        task.retryCount++;
        await this.taskRepository.save(task);
        break;

      case EscalationLevel.TEAM_PEER:
        // 같은 팀의 동료에게 협업 요청
        await this.createCollaborationRequest(task, hollon, 'team_peer');
        break;

      case EscalationLevel.DIRECT_MANAGER:
        // 직속 상사에게 에스컬레이션
        if (hollon.manager) {
          await this.createCollaborationRequest(
            task,
            hollon.manager,
            'manager',
          );
        } else {
          // 상사 없으면 다음 레벨로
          await this.escalate(taskId, hollonId, EscalationLevel.UPPER_MANAGER);
        }
        break;

      case EscalationLevel.UPPER_MANAGER:
        // 상위 팀 리더에게 에스컬레이션
        if (hollon.team?.parentTeam?.leader) {
          await this.createCollaborationRequest(
            task,
            hollon.team.parentTeam.leader,
            'upper_manager',
          );
        } else {
          // 상위 팀 없으면 인간으로
          await this.escalate(taskId, hollonId, EscalationLevel.HUMAN);
        }
        break;

      case EscalationLevel.HUMAN:
        // 인간에게 ApprovalRequest 생성
        await this.approvalRequestService.create({
          taskId: task.id,
          requestType: 'escalation',
          title: `Task failed: ${task.title}`,
          description: `Hollon ${hollon.name} failed to complete task after all escalation levels`,
          requestedByHollonId: hollon.id,
        });
        break;
    }
  }
}
```

---

## 🧪 테스트 계획

### 1. Migration 테스트

```bash
# Clean DB
pnpm db:query "DROP SCHEMA hollon_test_worker_1 CASCADE; CREATE SCHEMA hollon_test_worker_1;"

# Run migration
pnpm test:integration
```

### 2. Integration Test

```typescript
// test/e2e/hierarchical-organization.e2e-spec.ts

describe('Hierarchical Organization E2E', () => {
  it('should create hierarchical team structure', async () => {
    // 1. Create Engineering team
    const engineeringTeam = await request(app).post('/api/teams').send({
      name: 'Engineering',
      organizationId,
    });

    // 2. Create CTO (team leader)
    const cto = await request(app)
      .post('/api/hollons')
      .send({
        name: 'CTO',
        teamId: engineeringTeam.body.id,
        roleId: ctoRoleId,
        skills: ['architecture', 'leadership'],
        experienceLevel: 5,
      });

    // 3. Set CTO as team leader
    await request(app)
      .patch(`/api/teams/${engineeringTeam.body.id}`)
      .send({ leaderHollonId: cto.body.id });

    // 4. Create Backend sub-team
    const backendTeam = await request(app).post('/api/teams').send({
      name: 'Backend Team',
      organizationId,
      parentTeamId: engineeringTeam.body.id,
    });

    // 5. Create Tech Lead (reports to CTO)
    const techLead = await request(app)
      .post('/api/hollons')
      .send({
        name: 'Tech Lead Backend',
        teamId: backendTeam.body.id,
        roleId: techLeadRoleId,
        managerId: cto.body.id,
        skills: ['typescript', 'nestjs', 'architecture'],
        experienceLevel: 4,
      });

    // 6. Create Senior Dev (reports to Tech Lead)
    const seniorDev = await request(app)
      .post('/api/hollons')
      .send({
        name: 'Senior Backend Dev',
        teamId: backendTeam.body.id,
        roleId: seniorDevRoleId,
        managerId: techLead.body.id,
        skills: ['typescript', 'nestjs', 'database'],
        experienceLevel: 3,
      });

    expect(cto.body.managerId).toBeNull();
    expect(techLead.body.managerId).toBe(cto.body.id);
    expect(seniorDev.body.managerId).toBe(techLead.body.id);
  });

  it('should auto-assign tasks based on skills', async () => {
    // GoalDecomposition 실행
    const result = await request(app)
      .post(`/api/goals/${goalId}/decompose`)
      .send({ strategy: 'task_based' });

    const tasks = result.body.tasks;

    // Database task 찾기
    const databaseTask = tasks.find(
      (t) =>
        t.title.toLowerCase().includes('database') ||
        t.description.toLowerCase().includes('database'),
    );

    expect(databaseTask.assignedHollonId).toBeDefined();

    // 할당된 Hollon이 database skill 보유 확인
    const assignedHollon = await request(app).get(
      `/api/hollons/${databaseTask.assignedHollonId}`,
    );

    expect(assignedHollon.body.skills).toContain('database');
  });

  it('should escalate failed task through hierarchy', async () => {
    // Task 생성
    const task = await createTask({
      title: 'Complex Algorithm',
      assignedHollonId: seniorDev.body.id,
    });

    // Level 1: 재시도 (자기 해결)
    await request(app)
      .post(`/api/tasks/${task.id}/escalate`)
      .send({ level: 1 });

    let updatedTask = await getTask(task.id);
    expect(updatedTask.retryCount).toBe(1);

    // Level 2: 팀 내 협업
    await request(app)
      .post(`/api/tasks/${task.id}/escalate`)
      .send({ level: 2 });

    // CollaborationRequest 생성 확인
    const collaborations = await request(app).get(
      `/api/collaborations?taskId=${task.id}`,
    );

    expect(collaborations.body.length).toBeGreaterThan(0);

    // Level 3: 직속 상사 (Tech Lead)
    await request(app)
      .post(`/api/tasks/${task.id}/escalate`)
      .send({ level: 3 });

    const techLeadCollab = collaborations.body.find(
      (c) => c.targetHollonId === techLead.body.id,
    );
    expect(techLeadCollab).toBeDefined();

    // Level 5: 인간
    await request(app)
      .post(`/api/tasks/${task.id}/escalate`)
      .send({ level: 5 });

    const approvalRequests = await request(app).get(
      `/api/approval-requests?taskId=${task.id}`,
    );

    expect(approvalRequests.body.length).toBeGreaterThan(0);
  });
});
```

---

## 📅 구현 타임라인

### Day 1: Database Schema (4-6시간)

**오전 (2-3시간)**:

1. Migration 파일 작성
2. Entity 파일 수정 (Team, Hollon, Role)
3. Migration 실행 및 검증

**오후 (2-3시간)**: 4. Team/Hollon Service에 계층 구조 메서드 추가 5. 간단한 Unit Test 작성

### Day 2: DependencyAnalyzer + ResourcePlanner (4-6시간)

**오전 (2-3시간)**:

1. DependencyAnalyzer description 파싱 구현
2. Unit Test 작성

**오후 (2-3시간)**: 3. ResourcePlanner Skill 매칭 구현 4. GoalDecompositionController 통합 5. Integration Test 작성

### Day 3: Escalation Service (4-6시간)

**오전 (2-3시간)**:

1. EscalationService 구현
2. 5단계 Escalation 로직

**오후 (2-3시간)**: 3. CollaborationService 연동 4. ApprovalRequestService 연동 5. Unit Test 작성

### Day 4: E2E 테스트 및 검증 (4-6시간)

**오전 (2-3시간)**:

1. E2E 테스트 작성 (hierarchical-organization.e2e-spec.ts)
2. 전체 플로우 테스트

**오후 (2-3시간)**: 3. Dogfooding 2차 재실행 (GoalDecomposition) 4. 40개 Tasks 자동 할당 검증 5. 문서 업데이트

---

## ✅ 완료 기준

### Critical (필수)

- [ ] Migration 성공적으로 실행
- [ ] Team.parentTeamId 작동
- [ ] Hollon.managerId 작동
- [ ] Hollon.skills 배열 저장/조회
- [ ] DependencyAnalyzer description 파싱 및 task_dependencies 생성
- [ ] ResourcePlanner Skill 기반 Hollon 자동 할당
- [ ] GoalDecomposition → DependencyAnalyzer → ResourcePlanner 파이프라인

### Important (권장)

- [ ] Role.authorityLevel, autonomyLevel 설정
- [ ] EscalationService Level 1-5 구현
- [ ] E2E 테스트 통과
- [ ] Dogfooding 2차 재실행 (40 tasks 자동 할당 확인)

### Nice-to-have (선택)

- [ ] ApprovalPermissions 로직
- [ ] Skill 자동 추천 (Task 완료 시 경험 추가)
- [ ] Team/Hollon 계층 구조 시각화 API

---

## 🚀 Phase 4 Kickoff 준비

위 작업 완료 후:

1. **Hollon 팀 생성** (5-7명)
   - CTO Hollon
   - Tech Lead Hollon
   - Backend Dev Hollon (2-3명)
   - QA Hollon
   - Data Engineer Hollon

2. **Skill Matrix 설정**
   - 각 Hollon에 적절한 skills 할당
   - experienceLevel 설정

3. **Phase 4 Goal 생성 및 GoalDecomposition 실행**
   - 40개 Tasks 자동 생성
   - Dependencies 자동 추출
   - Hollon 자동 할당
   - **Phase 4 Dogfooding 시작!** 🚀

---

**문서 버전**: 1.0
**최종 업데이트**: 2025-12-09
**작성자**: Claude (with Human guidance)

---

# Phase 3.5 통합 플랜 (최종본 - 조직 지식 공유)

**작성일**: 2025-12-09 (최종)
**목표**: UI 없이 자율 작동 + 조직 레벨 지식 공유

---

## 📊 Blueprint.md Phase 분류 확인

### ✅ 올바른 Phase 분류

**Phase 1 (Week 5-6): 품질 및 안전장치**

- EscalationService (5단계)
- Human Approval 플로우 (기본)

**Phase 3 (Week 15-16): 전략-실행 연결**

- GoalDecompositionService ✅
- DependencyAnalyzer ⚠️ (description 파싱 필요)
- ResourcePlanner ⚠️ (Document 기반 할당)

**Phase 3.5 (확장): 자율 작동 완성**

- 계층적 팀 구조
- Computed Hollon Managers
- 조직 지식 공유 (Document 활용)
- 에스컬레이션 (Phase 2 활용)

**Phase 5 (Week 27-28): UI**

- ApprovalRequest + WebSocket
- 승인 센터 대시보드

---

## ✅ 자율 작동 가능 여부

### Phase 3.5 완료 후: **YES, 자율 작동 가능!**

```
사용자: Goal 생성
  ↓
🤖 GoalDecomposition: 40개 Tasks 생성
  ↓
🤖 DependencyAnalyzer: 의존성 링크
  ↓
🤖 ResourcePlanner: 스킬 기반 할당
  ↓
🤖 Hollon 자동 실행 (Phase 1 TaskPull)
  ↓
🤖 막히면 에스컬레이션 (Level 1-4 자동)
  ↓
🤖 Level 5: Task.needsHumanApproval = true
  ↓
사람: API로 승인 (PATCH /tasks/:id)
  ↓
🤖 작업 재개 → 완료
```

### UI 없이 작동하는 방법

**Level 5 에스컬레이션 시:**

```bash
# 1. Task 플래그 설정
task.needsHumanApproval = true
task.status = BLOCKED

# 2. 로그 출력
Logger.error("🚨 Human intervention needed for task: ...")

# 3. 사람이 API로 승인
curl -X PATCH /tasks/:id \
  -d '{"status": "TODO", "needsHumanApproval": false}'

# 4. 홀론 작업 재개
```

**Phase 5 UI 추가 시:**

- 웹에서 클릭으로 승인
- 실시간 WebSocket 알림
- 대시보드 모니터링

---

## 🔧 Phase 3.5 구현 범위 (최종본)

### 🧠 핵심 설계 결정: 조직 지식 공유

**기존 설계 문제점:**

```typescript
// ❌ 개별 성장 모델
Hollon "DevBot-1": skills: ["redis"]  // 혼자만 알고 있음
→ 문제: 지식 고립, 병목 현상, 중복 학습, 비현실적 (같은 Claude 모델)
```

**새 설계 원칙:**

```typescript
// ✅ 조직 지식 공유 모델
Task 완료 → Document 자동 생성 (scope: 'organization')
→ 모든 홀론이 접근 가능 (Phase 2 Document Entity 활용!)
→ 효과: 지식 재사용 50% 절감, 병목 해소, Phase 4 호환
```

### 1. Database Schema (수정본 - SSOT 준수)

```sql
-- ✅ 유지: 팀 계층 구조
ALTER TABLE "teams"
  ADD COLUMN "parent_team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  ADD COLUMN "leader_hollon_id" uuid REFERENCES "hollons"("id") ON DELETE SET NULL;

CREATE INDEX "idx_teams_parent_team_id" ON "teams"("parent_team_id");
CREATE INDEX "idx_teams_leader_hollon_id" ON "teams"("leader_hollon_id");

-- ✅ 추가: managerId (비정규화 저장 - 읽기 성능 우선!)
-- 이유: getManager() computed 방식은 JOIN 오버헤드 발생
--       에스컬레이션/협업 시 매니저 조회 빈번 (읽기 >> 쓰기)
ALTER TABLE "hollons"
  ADD COLUMN "manager_id" uuid REFERENCES "hollons"("id") ON DELETE SET NULL;

CREATE INDEX "idx_hollons_manager_id" ON "hollons"("manager_id");

COMMENT ON COLUMN "hollons"."manager_id" IS
  'Denormalized manager reference - updated when team structure changes.
   Read performance >> Write consistency (에스컬레이션 시 빈번한 조회)';

-- ✅ 추가: 경험 레벨 (통계적 성과 지표 - 개별 성장 아님!)
ALTER TABLE "hollons"
  ADD COLUMN "experience_level" varchar(50) DEFAULT 'junior';

COMMENT ON COLUMN "hollons"."experience_level" IS
  'Statistical performance metric for allocation priority.
   NOT individual growth - just allocation score (SSOT 원칙).
   Values: junior, mid, senior, lead, principal';

-- ✅ 추가: 프로젝트/태스크 확장
ALTER TABLE "projects"
  ADD COLUMN "assigned_team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL;

ALTER TABLE "tasks"
  ADD COLUMN "required_skills" text[] DEFAULT '{}',
  ADD COLUMN "needs_human_approval" boolean DEFAULT false;

CREATE INDEX "idx_projects_assigned_team_id" ON "projects"("assigned_team_id");
CREATE INDEX "idx_tasks_required_skills" ON "tasks" USING gin("required_skills");

-- ❌ 제거: 개별 홀론 스킬 (SSOT 위반!)
-- 이유: 홀론은 교체 가능한 워커, 스킬은 Role.capabilities에 속함
--       개별 홀론이 발전하는게 아니라 Role 프롬프트 + 조직 지식이 진화
-- ALTER TABLE "hollons" ADD COLUMN "skills" text[]; -- ❌ 삭제됨

-- ℹ️ Phase 1 Role Entity 활용 (이미 존재!)
-- Role.capabilities = ["typescript", "nestjs", "database"]
-- Role.systemPrompt = 롤 레벨 프롬프트 (진화 대상)

-- ℹ️ Phase 2 Document Entity 활용 (추가 변경 불필요)
-- Document.scope = 'organization' → 모든 홀론이 접근
-- Document.keywords = task.requiredSkills → 자동 검색
-- Document.metadata.successRate → Phase 4 학습
```

### 2. HollonService.getManager() (Stored - 성능 우선)

```typescript
/**
 * managerId에서 매니저 조회 (단순 JOIN)
 * 이유: 비정규화 저장으로 성능 최적화
 */
async getManager(hollonId: string): Promise<Hollon | null> {
  const hollon = await this.hollonRepo.findOne({
    where: { id: hollonId },
    relations: ['manager'], // 단순 JOIN (computed 대비 3배 빠름)
  });

  return hollon?.manager || null;
}

/**
 * 팀 구조 변경 시 managerId 동기화
 * 호출 시점: Team.leaderHollonId 변경, Hollon.teamId 변경
 */
async syncManagerReferences(teamId: string): Promise<void> {
  const team = await this.teamRepo.findOne({
    where: { id: teamId },
    relations: ['hollons', 'leader', 'parentTeam', 'parentTeam.leader'],
  });

  if (!team) return;

  for (const hollon of team.hollons) {
    // 팀 리더인 경우 → 상위 팀 리더가 매니저
    if (hollon.id === team.leaderHollonId) {
      hollon.managerId = team.parentTeam?.leaderHollonId || null;
    } else {
      // 팀원인 경우 → 현재 팀 리더가 매니저
      hollon.managerId = team.leaderHollonId;
    }
  }

  await this.hollonRepo.save(team.hollons);
  this.logger.log(`✅ Manager references synced for team: ${team.name}`);
}
```

### 3. ResourcePlanner (Role.capabilities 우선 매칭)

```typescript
/**
 * Task 할당: Role.capabilities > 조직 지식 > 경험 레벨
 * SSOT 원칙: 스킬은 Role에 속함, 개별 홀론 스킬 없음
 */
async assignTask(task: Task): Promise<Hollon | null> {
  // 1. 가용 홀론 목록 (Role.capabilities 포함)
  const availableHollons = await this.hollonRepo.find({
    where: {
      status: HollonStatus.IDLE,
      lifecycle: HollonLifecycle.PERMANENT,
    },
    relations: ['role', 'team'],
  });

  if (availableHollons.length === 0) return null;

  // 2. 관련 조직 지식 검색
  const relatedDocs = await this.documentRepo.find({
    where: {
      scope: 'organization',  // 조직 레벨 지식
      keywords: ArrayOverlap(task.requiredSkills || task.tags),
      type: In(['guide', 'memory']),
    },
    order: { createdAt: 'DESC' },
  });

  // 3. 스코어 계산 (Role 매칭 최우선!)
  const scored = availableHollons.map(hollon => ({
    hollon,
    score: this.calculateScore(hollon, task, relatedDocs),
  }));

  scored.sort((a, b) => b.score - a.score);

  const winner = scored[0];
  if (winner) {
    this.logger.log(
      `📍 Task "${task.title}" assigned to ${winner.hollon.name} ` +
      `(Role: ${winner.hollon.role?.name}, Score: ${winner.score})`
    );
  }

  return winner?.hollon || null;
}

private calculateScore(
  hollon: Hollon,
  task: Task,
  relatedDocs: Document[]
): number {
  let score = 0;

  // ✅ 1. Role.capabilities 매칭 (최우선 - 50점)
  const roleCapabilities = hollon.role?.capabilities || [];
  const taskSkills = task.requiredSkills || [];

  const matchCount = taskSkills.filter(skill =>
    roleCapabilities.some(cap =>
      cap.toLowerCase().includes(skill.toLowerCase())
    )
  ).length;

  score += matchCount * 50;  // 역할 매칭이 가장 중요!

  // ✅ 2. 조직 지식 존재 (20점)
  if (relatedDocs.length > 0) {
    score += 20;  // 지식 있으면 누구나 수행 가능
  }

  // ✅ 3. 경험 레벨 (통계적 성과만 - 10점)
  score += this.experienceLevelScore(hollon.experienceLevel);

  return score;
}

private experienceLevelScore(level: ExperienceLevel): number {
  const scores = {
    [ExperienceLevel.JUNIOR]: 2,
    [ExperienceLevel.MID]: 4,
    [ExperienceLevel.SENIOR]: 6,
    [ExperienceLevel.LEAD]: 8,
    [ExperienceLevel.PRINCIPAL]: 10,
  };
  return scores[level] || 0;
}
```

### 4. HollonService.reassignRole() (동적 역할 전환) 🆕

```typescript
/**
 * 팀 내 홀론의 역할을 동적으로 변경
 * SSOT 원칙: 홀론은 교체 가능한 워커, 역할 전환 가능
 *
 * 사용 예시:
 * - 백엔드 개발자 → 프론트엔드 개발자 (필요 시)
 * - 주니어 개발자 → QA 엔지니어 (일시적)
 * - 개발자 → 리뷰어 (코드 리뷰 시)
 */
async reassignRole(
  hollonId: string,
  newRoleId: string,
  reason?: string
): Promise<Hollon> {
  const hollon = await this.hollonRepo.findOne({
    where: { id: hollonId },
    relations: ['role', 'team'],
  });

  if (!hollon) {
    throw new NotFoundException(`Hollon ${hollonId} not found`);
  }

  const newRole = await this.roleRepo.findOne({
    where: { id: newRoleId },
  });

  if (!newRole) {
    throw new NotFoundException(`Role ${newRoleId} not found`);
  }

  const oldRoleName = hollon.role.name;

  // 역할 변경
  hollon.roleId = newRoleId;

  // 경험 레벨 초기화 (새 역할에서는 초보자)
  hollon.experienceLevel = ExperienceLevel.JUNIOR;

  await this.hollonRepo.save(hollon);

  this.logger.log(
    `🔄 Role reassignment: ${hollon.name} ` +
    `(${oldRoleName} → ${newRole.name}) ${reason ? `- ${reason}` : ''}`
  );

  // 팀 채널에 알림 (Phase 2 MessageService 활용)
  if (hollon.team) {
    await this.messageService.sendToChannel(hollon.team.channelId, {
      content: `${hollon.name} switched role: ${oldRoleName} → ${newRole.name}`,
      messageType: MessageType.ANNOUNCEMENT,
    });
  }

  return hollon;
}

/**
 * 특정 Role을 수행할 임시 홀론 스폰
 * SSOT 원칙: 임시 홀론 생성은 자율적 (Phase 1 정의)
 *
 * 사용 예시:
 * - Security Reviewer 홀론 (코드 리뷰 전용)
 * - Performance Tester 홀론 (부하 테스트 전용)
 * - Migration Specialist 홀론 (DB 마이그레이션 전용)
 */
async spawnTemporaryHollonForRole(
  roleId: string,
  teamId: string,
  reason: string
): Promise<Hollon> {
  const role = await this.roleRepo.findOne({ where: { id: roleId } });
  const team = await this.teamRepo.findOne({ where: { id: teamId } });

  if (!role || !team) {
    throw new NotFoundException('Role or Team not found');
  }

  // 임시 홀론 생성
  const tempHollon = this.hollonRepo.create({
    name: `${role.name}-temp-${Date.now()}`,
    roleId: role.id,
    teamId: team.id,
    organizationId: team.organizationId,
    lifecycle: HollonLifecycle.TEMPORARY, // 임시 홀론
    status: HollonStatus.IDLE,
    experienceLevel: ExperienceLevel.MID, // 임시는 중급으로 시작
    managerId: team.leaderHollonId, // 팀 리더가 매니저
  });

  await this.hollonRepo.save(tempHollon);

  this.logger.log(
    `🐣 Temporary hollon spawned: ${tempHollon.name} ` +
    `(Role: ${role.name}, Reason: ${reason})`
  );

  return tempHollon;
}

/**
 * 임시 홀론 종료 (태스크 완료 시)
 */
async terminateTemporaryHollon(hollonId: string): Promise<void> {
  const hollon = await this.hollonRepo.findOne({
    where: { id: hollonId, lifecycle: HollonLifecycle.TEMPORARY },
  });

  if (!hollon) {
    this.logger.warn(`Temporary hollon ${hollonId} not found or not temporary`);
    return;
  }

  await this.hollonRepo.softRemove(hollon);

  this.logger.log(`💀 Temporary hollon terminated: ${hollon.name}`);
}
```

### 5. TaskService.completeTask() (자동 지식 문서화)

```typescript
/**
 * Task 완료 시 자동으로 조직 지식 문서 생성
 */
async completeTask(taskId: string, hollonId: string, result: any): Promise<void> {
  const task = await this.taskRepo.findOne({
    where: { id: taskId },
    relations: ['assignedHollon'],
  });

  if (!task) {
    throw new NotFoundException(`Task ${taskId} not found`);
  }

  // Task 완료 처리
  task.status = TaskStatus.COMPLETED;
  task.completedAt = new Date();
  await this.taskRepo.save(task);

  // ✅ 자동 지식 문서화 (조직 레벨)
  await this.documentService.create({
    organizationId: task.organizationId,
    title: `${task.title} - 해결 패턴`,
    type: 'guide',
    scope: 'organization',  // 🔑 모든 홀론이 접근 가능!
    keywords: [
      ...(task.requiredSkills || []),
      ...(task.tags || []),
      task.type,
    ],
    content: `
# ${task.title}

## 개요
- **완료 홀론**: ${task.assignedHollon.name}
- **완료 일시**: ${new Date().toISOString()}
- **복잡도**: ${task.estimatedComplexity}

## 해결 방법
${result.solution || '(Brain Provider가 생성한 솔루션)'}

## 주요 코드 패턴
\`\`\`typescript
${result.codeSnippet || '// 코드 샘플'}
\`\`\`

## 주의사항
${result.gotchas || '특이사항 없음'}

## 성공률
- 첫 시도 성공: ${task.retryCount === 0 ? 'Yes' : 'No'}
- 재시도 횟수: ${task.retryCount}
    `,
    metadata: {
      taskId: task.id,
      hollonId: task.assignedHollonId,
      complexity: task.estimatedComplexity,
      successRate: task.retryCount === 0 ? 100 : 70,
      firstAttemptSuccess: task.retryCount === 0,
    },
  });

  this.logger.log(
    `📚 Knowledge documented: "${task.title}" (accessible to all hollons)`
  );
}
```

### 5. BrainProvider (지식 주입)

```typescript
/**
 * Task 실행 시 조직 지식 자동 주입
 */
async executeTask(hollonId: string, taskId: string): Promise<any> {
  const task = await this.taskRepo.findOne({
    where: { id: taskId },
  });

  const hollon = await this.hollonRepo.findOne({
    where: { id: hollonId },
    relations: ['role', 'team'],
  });

  // ✅ 1. 관련 지식 문서 검색
  const relatedKnowledge = await this.documentRepo.find({
    where: {
      scope: 'organization',
      keywords: ArrayOverlap(task.requiredSkills || task.tags),
      type: In(['guide', 'memory']),
    },
    order: { createdAt: 'DESC' },
    take: 5,  // 최근 5개
  });

  // ✅ 2. 프롬프트에 지식 주입
  const knowledgeContext = relatedKnowledge.length > 0
    ? `
## 📚 Organization Knowledge (관련 해결 패턴)

${relatedKnowledge.map(doc => `
### ${doc.title}
${doc.content}
---
`).join('\n')}
    `
    : '';

  // ✅ 3. Brain Provider 실행
  const prompt = `
You are ${hollon.name}, a ${hollon.role.name} in the ${hollon.team?.name} team.

## Task
${task.title}

${task.description}

## Acceptance Criteria
${(task.acceptanceCriteria || []).map((c, i) => `${i + 1}. ${c}`).join('\n')}

${knowledgeContext}

## Your Task
Implement the solution following the organization's patterns above.
  `;

  return await this.brainProvider.execute(hollonId, prompt);
}
```

### 4. DependencyAnalyzer 통합

```typescript
// GoalDecompositionService.createWorkItems() 수정
private async createWorkItems(...) {
  // ... Projects/Tasks 생성

  // 🆕 의존성 링크
  await this.linkTaskDependencies(allTasks);

  // 🆕 자동 할당
  for (const project of createdProjects) {
    if (project.assignedTeamId) {
      await this.resourcePlanner.assignProjectTasks(project.id, project.assignedTeamId);
    }
  }
}
```

### 5. EscalationService (Phase 2 활용!)

```typescript
// Level 2: 팀 협업 (CollaborationService 활용)
await this.collaborationService.requestCollaboration(hollon.id, {
  type: 'CODE_REVIEW',
  taskId: task.id,
  description: `🆘 Help needed: ${reason}`,
});

// Level 3: 매니저에게 (MessageService 활용)
const manager = await this.hollonService.getManager(hollon.id);
await this.messageService.send({
  fromId: hollon.id,
  toId: manager.id,
  messageType: MessageType.COLLABORATION_REQUEST,
  content: `⚠️ Escalation: ${reason}`,
});

// Level 5: 인간 (플래그만)
task.needsHumanApproval = true;
task.status = TaskStatus.BLOCKED;
this.logger.error(`🚨 HUMAN INTERVENTION: ${task.title}`);
```

---

## 📅 구현 타임라인 (5-6일)

### Day 1: Schema & Stored Manager (SSOT 준수)

1. Migration 업데이트 (managerId 추가, skills 제거 유지)
2. Entity 업데이트 (Hollon, Project, Task)
3. Migration 실행
4. HollonService.getManager() 구현 (stored + sync)
5. HollonService.syncManagerReferences() 구현
6. Unit test

### Day 2: Role 기반 지식 공유 (SSOT 준수)

7. ResourcePlanner Role.capabilities 우선 매칭
8. TaskService.completeTask() 자동 지식 문서화
9. BrainProvider 지식 주입 로직
10. HollonService.reassignRole() 구현 (역할 전환) 🆕
11. HollonService.spawnTemporaryHollonForRole() 구현 🆕
12. Integration test

### Day 3: Dependencies & Escalation

13. DependencyAnalyzer description 파싱
14. GoalDecomposition.linkTaskDependencies() 구현
15. EscalationService DECOMPOSE/SIMPLIFY (MessageService 활용)
16. Integration test

### Day 4-5: Git Worktree + CodeReview 자동화

17. TaskExecutionService 구현 (Worktree 생성/정리)
18. TaskExecutionService PR 생성 (gh CLI)
19. CodeReviewService 통합 (Phase 2 활용)
20. ReviewerHollonService 구현 (자동 리뷰)
21. MessageListener (REVIEW_REQUEST → 자동 리뷰)
22. 자동 Merge 이벤트 핸들러
23. 전문 리뷰어 Hollon 생성 스크립트
24. Integration test

### Day 6: E2E Testing (SSOT 검증)

25. 계층적 팀 생성 테스트
26. Role.capabilities 기반 할당 검증 🆕
27. 역할 전환 테스트 (Backend → Frontend) 🆕
28. 임시 홀론 스폰/종료 테스트 🆕
29. Goal → Task → Worktree → PR → Review → Merge 전체 플로우
30. 지식 공유 검증 (두 번째 Task가 첫 번째 지식 활용)
31. 에스컬레이션 체인 테스트
32. 리뷰어 자동 할당 테스트 (Security/Architecture/Performance)
33. SSOT 원칙 준수 검증 (개별 스킬 없음, Role 기반만) 🆕
34. 전체 플로우 검증

---

## ✅ 완료 후 시스템 상태

### 자율 작동 가능

1. **Goal 입력만으로 전체 실행**: ✅
2. **자동 태스크 할당 (Document 기반 지식 매칭)**: ✅
3. **자동 의존성 관리**: ✅
4. **자동 에스컬레이션 (Level 1-4)**: ✅
5. **팀 내 협업 (Phase 2)**: ✅
6. **매니저 계층 (computed)**: ✅
7. **Git Worktree 자동 생성**: ✅ 🆕
8. **코드 작성 + 자동 커밋**: ✅ 🆕
9. **PR 자동 생성**: ✅ 🆕
10. **리뷰어 자동 할당 (Phase 2)**: ✅ 🆕
11. **자동 코드 리뷰 (Reviewer Hollon)**: ✅ 🆕
12. **자동 PR Merge (승인 시)**: ✅ 🆕
13. **조직 지식 자동 문서화**: ✅ 🆕

### Phase 5에서 추가될 것

1. 승인 센터 UI (웹 클릭)
2. 실시간 WebSocket 알림
3. 대시보드 시각화

---

## 🎯 ssot.md 요구사항 충족

| 요구사항           | 구현                             | 상태 |
| ------------------ | -------------------------------- | ---- |
| 자율 작동          | Level 1-4 자동                   | ✅   |
| 팀 내 협업         | CollaborationService (Phase 2)   | ✅   |
| 팀 간 협업         | CrossTeamCollaboration (Phase 2) | ✅   |
| 인간 승인          | needsHumanApproval 플래그        | ✅   |
| 에스컬레이션 5단계 | EscalationService                | ✅   |
| 매니저 계층        | Computed getManager()            | ✅   |

---

## 💡 핵심 설계 결정

### 1. Computed Manager (NOT Stored)

**이유**: 팀 구조 변경 시 자동 업데이트

```typescript
// ❌ Stored (문제)
hollon.managerId = 'abc123';
// 팀 리더 변경 시 모든 홀론 업데이트 필요

// ✅ Computed (해결)
hollon.manager = await getManager(hollonId);
// 팀 구조만 변경하면 자동 반영
```

### 2. Phase 2 협업 시스템 활용

**이유**: 새로 만들지 말고 기존 시스템 활용

```typescript
// ✅ Phase 2 CollaborationService
await this.collaborationService.requestCollaboration(...)

// ✅ Phase 2 MessageService
await this.messageService.send(...)

// ❌ 새로운 NotificationService 만들기 (Phase 5에서)
```

### 3. UI 없는 Human Approval

**이유**: Phase 5 전까지는 API로 승인

```typescript
// Phase 3.5: 플래그 + API
task.needsHumanApproval = true;
// API: PATCH /tasks/:id

// Phase 5: UI 추가
// 웹에서 클릭 → 같은 API 호출
```

---

**문서 버전**: 2.0 (수정본)  
**최종 업데이트**: 2025-12-09  
**변경사항**: Blueprint.md 준수, UI 제거, Phase 2 활용

---

## 🔄 에스컬레이션 재설계 (개선안)

### 문제점 분석

**❌ 기존 5단계 고정 설계:**

```
Level 3: Tech Lead → 단순 재실행 (같은 클로드, 차이 없음)
Level 4: Senior Manager → 단순 재실행 (의미 없음)
```

**❌ 모든 조직 구조에 5단계가 존재하지 않음:**

```
CTO 직속 개발자 → Level 2 동료 없음
                 → Level 4 상위 매니저 없음
                 → 강제로 5단계?
```

### ✅ 동적 액션 기반 에스컬레이션

```typescript
enum EscalationAction {
  RETRY = 'retry',          // 재시도 (같은 홀론)
  PEER_HELP = 'peer_help',  // 동료 협업 (Phase 2)
  DECOMPOSE = 'decompose',  // 🆕 태스크 분해
  SIMPLIFY = 'simplify',    // 🆕 태스크 단순화
  HUMAN = 'human',          // 인간 개입
}

// 사용 가능한 액션만 실행
async escalate(task: Task, hollon: Hollon) {
  const actions = await this.getAvailableActions(hollon);

  // RETRY → PEER_HELP (있으면) → DECOMPOSE (매니저 있으면)
  //  → SIMPLIFY → HUMAN
}
```

### 🆕 유의미한 매니저 에스컬레이션

#### 1. DECOMPOSE - 태스크 분해

```typescript
/**
 * 매니저가 복잡한 태스크를 서브태스크로 쪼갬
 */
async decomposeTask(task: Task, hollon: Hollon) {
  const manager = await this.getManager(hollon.id);

  // 매니저 LLM 호출 (TaskAnalyzer 활용)
  const subtasks = await this.brainProvider.execute(manager.id, `
    Decompose "${task.title}" into 2-3 simpler subtasks.
    Reason for failure: ${task.failedReason}
  `);

  // 서브태스크 생성 (원래 담당자에게 할당)
  for (const sub of subtasks) {
    await this.createSubtask(sub, task, hollon);
  }

  task.status = TaskStatus.DECOMPOSED;
}
```

#### 2. SIMPLIFY - 요구사항 축소

```typescript
/**
 * 매니저가 acceptance criteria 축소
 */
async simplifyTask(task: Task, hollon: Hollon) {
  const manager = await this.getManager(hollon.id);

  // 매니저 판단
  const simplified = await this.brainProvider.execute(manager.id, `
    Task too complex. Simplify requirements:
    Original: ${task.acceptanceCriteria}

    Reduce to MVP version.
  `);

  task.acceptanceCriteria = simplified.criteria;
  task.metadata.removedFeatures = simplified.removed;

  // 홀론에게 알림
  await this.messageService.send({
    fromId: manager.id,
    toId: hollon.id,
    content: "Task simplified. Please retry with reduced scope.",
  });
}
```

### 예시: CTO 직속 개발자

```
개발자 (peers 없음, manager = CTO):

Task 실패
  ↓
1. RETRY (3번) → 실패
  ↓
2. PEER_HELP → 동료 없음 (스킵)
  ↓
3. DECOMPOSE → CTO가 태스크 쪼갬
   └─> 서브태스크 3개 생성
   └─> 개발자가 순차 수행
  ↓
서브태스크도 실패?
  ↓
4. SIMPLIFY → CTO가 요구사항 축소
   └─> "완벽한 구현" → "MVP만"
   └─> 재시도
  ↓
여전히 실패?
  ↓
5. HUMAN → 사람 개입
```

### Phase 4와의 연계

**Phase 3.5**: 매니저가 **수동**으로 분해/단순화  
**Phase 4**: 매니저가 **학습**하여 패턴 개선

- PerformanceAnalyzer: "어떤 태스크가 자주 실패하는가?"
- PromptOptimizer: "분해 프롬프트 개선"
- KnowledgeExtraction: "성공한 분해 패턴 저장"

**M4 검증**: "동일 유형 태스크 5회 수행 후 효율성 20% 향상"
→ 4번째부터는 자동으로 적절히 분해됨

---

**문서 버전**: 2.1 (에스컬레이션 재설계)  
**최종 업데이트**: 2025-12-09  
**변경사항**: 동적 액션 기반 에스컬레이션, DECOMPOSE/SIMPLIFY 추가

---

## 📚 참조 문서

**지식 공유 전략 상세**: `/docs/phase3.5-knowledge-sharing.md`

- Hollon.skills 제거 이유
- 조직 레벨 지식 공유 모델
- Document 기반 ResourcePlanner
- Task 완료 시 자동 지식 문서화
- Phase 4 준비 상태

---

**문서 버전**: 2.2 (지식 공유 전략 분리)
**최종 업데이트**: 2025-12-09
**변경사항**:

- Hollon.skills 제거 → 조직 레벨 지식 공유
- 상세 내용은 phase3.5-knowledge-sharing.md 참조

---

## 📈 Phase 3.5 효과 분석

### Before (개별 성장 모델)

```
Scenario: Redis Cache 구현 Task

Week 1: DevBot-1 Redis 학습 + 구현 (4시간)
Week 2: DevBot-2 Redis 학습 + 구현 (4시간) ❌ 중복
Week 3: DevBot-3 Redis 학습 + 구현 (4시간) ❌ 중복

총 소요: 12시간
지식 고립: DevBot-1만 redis 가능
병목: DevBot-1 바쁘면 대기
```

### After (조직 지식 공유 모델)

```
Week 1: DevBot-1 Redis 학습 + 구현 (4시간)
        → Document 자동 생성 (organization scope)

Week 2: DevBot-2 Document 읽고 구현 (1시간) ✅
Week 3: DevBot-3 Document 읽고 구현 (1시간) ✅

총 소요: 6시간 (50% 절감)
병목 해소: 모든 홀론이 redis 가능
지식 영구 보존: Document 활용
```

### 추가 효과

1. **병목 해소**: 모든 홀론이 모든 Task 수행 가능
2. **지식 손실 방지**: Hollon 삭제해도 Document 남음
3. **Phase 4 호환**: KnowledgeGraph가 Document 활용
4. **현실적**: 같은 Claude 모델 (개별 차이 없음)

---

## 🎯 Phase 4 준비 상태

Phase 3.5 완료 후 Phase 4에서 구현할 것들이 이미 준비됨:

```typescript
✅ KnowledgeExtractionService
  → Document.keywords 자동 추출
  → 이미 TaskService.completeTask()에서 구현!

✅ KnowledgeGraphService
  → Document 간 관계 분석
  → Document Entity 그대로 활용

✅ BestPracticeService
  → Document.metadata.successRate 분석
  → 성공률 높은 패턴 추천

✅ PerformanceAnalyzer
  → Document 생성 빈도 분석
  → 어떤 Task가 반복되는지 추적
  → 조직 전체 성과 분석 (개별 홀론 아님)
```

---

## 🔄 Phase 1-3 기존 구현 재사용

Phase 3.5는 **기존 구현을 최대한 재사용**하여 개발 시간을 단축합니다:

### ✅ Phase 1 (완전 재사용)

| 서비스                        | 용도                  | 상태                           |
| ----------------------------- | --------------------- | ------------------------------ |
| **PromptComposerService**     | 6-layer 프롬프트 합성 | ✅ 그대로 사용                 |
| **TaskPoolService**           | Task 자동 Pull        | ✅ 그대로 사용                 |
| **HollonOrchestratorService** | 실행 사이클           | ✅ TaskExecutionService로 확장 |
| **EscalationService**         | 5단계 Escalation      | ✅ DECOMPOSE/SIMPLIFY 추가     |
| **QualityGateService**        | 코드 품질 검증        | ✅ PR 생성 전 사용             |
| **CostTrackingService**       | 비용 추적             | ✅ 그대로 사용                 |

### ✅ Phase 2 (완전 재사용)

| 서비스                            | 용도               | 상태                         |
| --------------------------------- | ------------------ | ---------------------------- |
| **MessageService**                | 홀론 간 메시지     | ✅ Escalation Level 3-4 사용 |
| **CollaborationService**          | 협업 요청          | ✅ Escalation Level 2 사용   |
| **CodeReviewService**             | PR 생성/리뷰/Merge | ✅ 완전 재사용! 🎯           |
| **ChannelService**                | 팀 채널            | ✅ 지식 공유 알림            |
| **StandupService**                | 일일 리포트        | ✅ 그대로 사용               |
| **RetrospectiveService**          | 회고               | ✅ 그대로 사용               |
| **CrossTeamCollaborationService** | 팀 간 협업         | ✅ 그대로 사용               |

### ✅ Phase 3 (확장 사용)

| 서비스                       | 용도             | 상태                     |
| ---------------------------- | ---------------- | ------------------------ |
| **GoalDecompositionService** | Goal → Task 분해 | ✅ 그대로 사용           |
| **DependencyAnalyzer**       | 의존성 분석      | 🆕 description 파싱 추가 |
| **ResourcePlanner**          | Hollon 할당      | 🆕 Document 검색 추가    |

### 🔑 SSOT 핵심 원칙 (Phase 3.5 설계 철학) 🆕

**1. 홀론 = 교체 가능한 워커 (NOT 성장하는 개인)**

```
❌ 잘못된 이해: DevBot-1이 Redis 학습 → DevBot-1만 Redis 가능
✅ 올바른 이해: Role "Backend Dev"가 Redis 역량 보유
               → 모든 Backend Dev 홀론이 Document 통해 Redis 수행 가능
               → 홀론은 같은 Claude 모델, 개별 차이 없음
```

**2. 진화 = Role 프롬프트 + 조직 지식 (NOT 개별 홀론)**

```
❌ 잘못된 이해: DevBot-1의 경험치 증가, 레벨업
✅ 올바른 이해:
   - Role.systemPrompt 개선 (Phase 4 PromptOptimizer)
   - Document (scope: organization) 축적
   - 모든 홀론이 진화한 지식 공유
```

**3. 경험 레벨 = 통계적 성과 지표 (NOT 개인 성장)**

```
❌ 잘못된 이해: DevBot-1이 태스크 많이 해서 Senior로 승급
✅ 올바른 이해:
   - experienceLevel = 할당 우선순위 점수일 뿐
   - 같은 Role끼리는 능력 동일 (같은 systemPrompt + 같은 Document 접근)
   - Senior는 단지 "더 복잡한 태스크 먼저 시도" 정도
```

**4. 스킬 = Role.capabilities (NOT Hollon.skills)**

```
❌ 잘못된 설계:
   Hollon "DevBot-1": skills: ["redis", "nestjs"]
   Hollon "DevBot-2": skills: ["postgres"]
   → DevBot-1 바쁘면 Redis 태스크 병목

✅ 올바른 설계:
   Role "Backend Developer": capabilities: ["typescript", "nestjs", "database"]
   + Document "Redis 구현 가이드" (scope: organization)
   → 모든 Backend Dev가 Redis 가능, 병목 없음
```

**5. 유연성 = 역할 전환 + 임시 스폰**

```
✅ 역할 전환 (팀 내):
   Backend Dev → Frontend Dev (필요 시)
   → experienceLevel 초기화 (새 역할에서는 초보자)

✅ 임시 홀론 스폰 (특정 Role):
   Security Reviewer 홀론 (코드 리뷰 전용)
   → 작업 완료 후 자동 종료
```

**Phase 4 연계:**

- **개별 홀론 추적 ❌**: PerformanceAnalyzer가 홀론별 통계 내는게 아님
- **조직 성과 분석 ✅**: 어떤 Task 유형이 자주 실패? 어떤 패턴이 성공?
- **Role 진화 ✅**: Role.systemPrompt 최적화, Organization Document 축적
- **Knowledge Graph ✅**: Document 간 관계 분석, 재사용 패턴 발견

---

### 🆕 Phase 3.5 신규 구현 (최소)

1. **TaskExecutionService** (HollonOrchestratorService 확장)
   - Worktree 생성/정리
   - PR 생성 (gh CLI)
   - CodeReviewService 통합

2. **ReviewerHollonService** (새 서비스)
   - PR diff 다운로드
   - BrainProvider 자동 리뷰
   - CodeReviewService.submitReview() 호출

3. **MessageListener** (이벤트 핸들러)
   - REVIEW_REQUEST → ReviewerHollonService 트리거

**개발 시간 절감 효과**:

- 기존 구현 재사용: 70%
- 신규 구현: 30%
- **예상 개발 기간**: 5-6일 → **3-4일**로 단축 가능!

---

## 🔧 Git Worktree 자동화 (Phase 3.5 핵심)

### 1. TaskExecutionService 구현

```typescript
/**
 * Task 실행 → Worktree → 코딩 → 커밋 → PR 생성
 */
@Injectable()
export class TaskExecutionService {
  async executeTask(taskId: string, hollonId: string): Promise<void> {
    // 1. Worktree 생성
    const worktreePath = await this.createWorktree(project, task);

    // 2. BrainProvider 실행 (worktree 경로에서)
    const result = await this.executeBrainProvider(
      hollonId,
      task,
      worktreePath,
    );

    // 3. PR 생성
    const prUrl = await this.createPullRequest(project, task, worktreePath);

    // 4. CodeReview 요청 (Phase 2 활용)
    await this.requestCodeReview(task, prUrl, hollonId);

    // 5. Worktree 정리
    await this.cleanupWorktree(worktreePath);
  }

  private async createWorktree(project: Project, task: Task): Promise<string> {
    const branchName = `feature/task-${task.id.slice(0, 8)}`;
    const worktreePath = path.join(
      project.workingDirectory,
      '..',
      `task-${task.id.slice(0, 8)}`,
    );

    await execAsync(`git worktree add ${worktreePath} -b ${branchName}`, {
      cwd: project.workingDirectory,
    });

    return worktreePath;
  }

  private async createPullRequest(
    project: Project,
    task: Task,
    worktreePath: string,
  ): Promise<string> {
    const branchName = `feature/task-${task.id.slice(0, 8)}`;

    // Push
    await execAsync(`git push -u origin ${branchName}`, { cwd: worktreePath });

    // Create PR
    const { stdout } = await execAsync(
      `gh pr create --title "${task.title}" --body "..." --base main`,
      { cwd: worktreePath },
    );

    return stdout.trim(); // PR URL
  }

  private async requestCodeReview(
    task: Task,
    prUrl: string,
    authorHollonId: string,
  ): Promise<void> {
    const prNumber = this.extractPRNumber(prUrl);

    // TaskPullRequest 생성 (Phase 2)
    const pr = await this.codeReviewService.createPullRequest({
      taskId: task.id,
      prNumber,
      prUrl,
      repository: task.project.repositoryUrl,
      branchName: `feature/task-${task.id.slice(0, 8)}`,
      authorHollonId,
    });

    // 리뷰어 자동 할당 (Phase 2)
    await this.codeReviewService.requestReview(pr.id);
  }
}
```

### 2. ReviewerHollonService 구현

```typescript
/**
 * 리뷰어 Hollon이 PR 자동 리뷰
 */
@Injectable()
export class ReviewerHollonService {
  async performReview(prId: string, reviewerHollonId: string): Promise<void> {
    const pr = await this.codeReviewService.getPullRequest(prId);

    // 1. PR diff 다운로드
    const diff = await this.fetchPRDiff(pr.prUrl);

    // 2. BrainProvider로 리뷰
    const reviewResult = await this.executeReviewWithBrain(
      reviewerHollonId,
      pr,
      diff,
    );

    // 3. 리뷰 제출
    await this.codeReviewService.submitReview(prId, reviewerHollonId, {
      decision: reviewResult.decision,
      comments: reviewResult.comments,
    });
  }

  private async executeReviewWithBrain(
    reviewerHollonId: string,
    pr: TaskPullRequest,
    diff: string,
  ) {
    const hollon = await this.hollonRepo.findOne({
      where: { id: reviewerHollonId },
      relations: ['role'],
    });

    const prompt = `
You are ${hollon.name}, a ${pr.reviewerType} reviewer.

## Code Changes
\`\`\`diff
${diff}
\`\`\`

${this.getReviewerGuidelines(pr.reviewerType)}

## Output (JSON)
{
  "approved": true | false,
  "comments": "review comments"
}
    `;

    const brainProvider = await this.brainProviderFactory.get(reviewerHollonId);
    const result = await brainProvider.execute(reviewerHollonId, prompt);

    return {
      decision: result.approved
        ? PullRequestStatus.APPROVED
        : PullRequestStatus.CHANGES_REQUESTED,
      comments: result.comments,
    };
  }

  private getReviewerGuidelines(type: ReviewerType | null): string {
    switch (type) {
      case ReviewerType.SECURITY_REVIEWER:
        return 'Check for security vulnerabilities (SQL injection, XSS, hardcoded secrets)';
      case ReviewerType.ARCHITECTURE_REVIEWER:
        return 'Review architecture design, SOLID principles, maintainability';
      case ReviewerType.PERFORMANCE_REVIEWER:
        return 'Check performance (N+1 queries, indexing, caching, algorithm complexity)';
      default:
        return 'Review code quality, readability, tests, error handling';
    }
  }
}
```

### 3. MessageListener (자동 리뷰 트리거)

```typescript
/**
 * REVIEW_REQUEST 메시지 수신 시 자동 리뷰 실행
 */
@Injectable()
export class ReviewRequestListener {
  @OnEvent('message.received')
  async handleReviewRequest(event: MessageReceivedEvent) {
    const { message } = event;

    if (message.messageType !== MessageType.REVIEW_REQUEST) {
      return;
    }

    const prId = message.metadata?.prId;
    if (!prId) return;

    // 🚀 자동 리뷰 실행
    await this.reviewerHollonService.performReview(prId, message.toId);
  }
}
```

### 4. 자동 Merge (리뷰 승인 시)

```typescript
/**
 * PR APPROVED 시 자동 Merge
 */
@OnEvent('code-review.approved')
async handleReviewApproved(event: ReviewApprovedEvent) {
  const { prId } = event;

  // Merge 실행
  await this.codeReviewService.mergePullRequest(prId);

  // Task 완료 처리 (이미 CodeReviewService에서 처리됨)
}
```

---

## ✅ 완료 기준 (SSOT 준수 최종본)

### Critical (필수 - SSOT 원칙)

- [ ] Migration 성공적으로 실행
- [ ] Team.parentTeamId, leaderHollonId 작동
- [ ] **Hollon.managerId 작동 (stored - 성능 우선!)** ✅ 수정
- [ ] Hollon.experienceLevel 작동 (통계적 지표만)
- [ ] **Hollon.skills 컬럼 없음 (Role.capabilities 사용!)** ✅ 중요
- [ ] Project.assignedTeamId 작동
- [ ] Task.requiredSkills, needsHumanApproval 작동
- [ ] **HollonService.getManager() 구현 (stored + sync)** ✅ 수정
- [ ] **HollonService.syncManagerReferences() 구현** 🆕
- [ ] **ResourcePlanner Role.capabilities 우선 매칭** ✅ 수정
- [ ] TaskService 완료 시 Document 자동 생성
- [ ] BrainProvider 지식 주입
- [ ] **HollonService.reassignRole() 구현 (역할 전환)** 🆕
- [ ] **HollonService.spawnTemporaryHollonForRole() 구현** 🆕
- [ ] **TaskExecutionService 구현 (Worktree + PR 생성)** 🆕
- [ ] **ReviewerHollonService 구현 (자동 코드 리뷰)** 🆕
- [ ] **MessageListener (REVIEW_REQUEST → 자동 리뷰)** 🆕

### Important (권장)

- [ ] DependencyAnalyzer description 파싱
- [ ] GoalDecomposition 통합
- [ ] EscalationService DECOMPOSE/SIMPLIFY
- [ ] E2E 테스트 (계층 구조, 지식 공유)
- [ ] **E2E 테스트: Role 기반 할당 검증** 🆕
- [ ] **E2E 테스트: 역할 전환 (Backend → Frontend)** 🆕
- [ ] **E2E 테스트: 임시 홀론 스폰/종료** 🆕
- [ ] **자동 PR Merge (APPROVED 시)** 🆕
- [ ] **전문 리뷰어 Hollon 생성 (Security/Architecture/Performance)** 🆕

### Nice-to-have (선택)

- [ ] Document 자동 태깅 개선
- [ ] 지식 검색 성능 최적화
- [ ] 팀별 지식 분리 (team scope)
- [ ] **PR diff 캐싱 (성능 최적화)** 🆕
- [ ] **리뷰 품질 측정 (Phase 4 준비)** 🆕
- [ ] **managerId 동기화 자동화 (Team 변경 시 트리거)** 🆕

---

**문서 버전**: 4.0 (SSOT 준수 - 최종 수정본)
**최종 업데이트**: 2025-12-09
**변경사항 (v3.1 → v4.0)**:

**🔑 SSOT 원칙 준수 (핵심 수정):**

- ✅ **Hollon.managerId stored 방식으로 변경** (computed → stored, 성능 우선)
- ✅ **Hollon.skills 제거 확정** (Role.capabilities 사용)
- ✅ **경험 레벨 = 통계적 지표** (개별 성장 아님)
- ✅ **진화 = Role + Organization 레벨** (개별 홀론 아님)

**🆕 신규 기능 추가:**

- HollonService.syncManagerReferences() (팀 구조 변경 시 동기화)
- HollonService.reassignRole() (동적 역할 전환)
- HollonService.spawnTemporaryHollonForRole() (임시 홀론 스폰)
- ResourcePlanner Role.capabilities 우선 매칭 (50점 가중치)

**📚 문서 개선:**

- SSOT 핵심 원칙 섹션 추가 (설계 철학 명확화)
- 5가지 핵심 원칙 상세 설명
- Phase 4 연계 명확화 (조직 성과 분석, Role 진화)

**기존 기능 (v3.1 유지):**

- Phase 3.5 내용 통합
- 조직 지식 공유 전략 반영
- TaskService 자동 지식 문서화
- BrainProvider 지식 주입
- TaskExecutionService (Git Worktree + PR 자동 생성)
- ReviewerHollonService (자동 코드 리뷰)
- Phase 2 CodeReviewService 완전 통합
- 타임라인 5-6일
