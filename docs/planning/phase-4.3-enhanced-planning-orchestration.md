# Phase 4.3: Enhanced Planning with Sub-Hollon Orchestration

## Overview

현재 Planning Workflow는 단일 `PlanningSpecialist` sub-hollon이 전체 계획을 생성합니다.
이 Phase에서는 Manager 또는 Team Member가 여러 role-specific sub-hollon을 생성하여
오케스트레이션하는 방식으로 개선합니다.

## Current State (Phase 4.2)

```
Goal → Team Epic (needsPlanning=true) → Planning Task
                                              ↓
                                    PlanningSpecialist (단독)
                                              ↓
                                    Plan Document → PR
```

**문제점:**

- 단일 hollon이 모든 역할(아키텍처, 보안, 테스트 등)의 관점을 커버해야 함
- 복잡한 task는 10분 timeout에도 불구하고 품질 저하 가능
- 전문성 분산 없이 일반화된 분석만 제공

## Proposed Architecture (Phase 4.3)

```
Goal → Team Epic (needsPlanning=true) → Planning Task
                                              ↓
                                    Manager/TeamMember (Orchestrator)
                                              ↓
                    ┌──────────────────────────────────────────────┐
                    │     Temporary Sub-Hollons (Planning Mode)    │
                    │                                              │
                    │  ┌─────────────┐  ┌─────────────┐           │
                    │  │ Architect   │  │ Security    │           │
                    │  │ Specialist  │  │ Reviewer    │           │
                    │  └─────────────┘  └─────────────┘           │
                    │                                              │
                    │  ┌─────────────┐  ┌─────────────┐           │
                    │  │ Test        │  │ Performance │           │
                    │  │ Strategist  │  │ Analyst     │           │
                    │  └─────────────┘  └─────────────┘           │
                    └──────────────────────────────────────────────┘
                                              ↓
                              Orchestrator aggregates analyses
                                              ↓
                                    Plan Document → PR
```

## Key Design Principles

### 1. Reuse Existing Sub-Hollon Logic

`handleComplexTask` in `hollon-orchestrator.service.ts`의 패턴을 재활용:

```typescript
// 기존 코드 (hollon-orchestrator.service.ts:567)
const subHollon = await this.hollonService.createTemporary(parentHollon, {
  name: `${specialistRole}-${taskId.substring(0, 8)}`,
  systemPrompt: specialistPrompt,
  capabilities: ['code_analysis', 'planning'],
  disallowedTools: ['Write', 'Edit', 'Bash', 'MultiEdit'], // 코드 수정 금지
});
```

### 2. Planning Mode Constraints

**모든 Planning Sub-Hollon에 적용:**

```typescript
const PLANNING_MODE_DISALLOWED_TOOLS = [
  'Write', // 파일 생성 금지
  'Edit', // 파일 수정 금지
  'Bash', // 시스템 명령 금지
  'MultiEdit', // 다중 파일 수정 금지
];
```

**Sub-hollon은 분석만 수행:**

- 코드베이스 탐색 (Read, Glob, Grep)
- 아키텍처 분석
- 영향도 평가
- 권장사항 제시

### 3. Hollon Depth Structure (현행)

```
depth=0: Permanent Hollon (Manager, TeamMember 모두)
         예: TechLead-Alpha, Developer-Bravo, CTO-Zeus

depth=1: Temporary Hollon (depth=0이 task 실행 중 생성)
         예: ArchitectSpecialist-a1b2c3d4
```

**현재 제약:** `MAX_TEMPORARY_HOLLON_DEPTH = 1`

- depth=0 → depth=1 생성 ✅ 가능
- depth=1 → depth=2 생성 ❌ 불가

**결론:** Manager도 depth=0이므로 이미 temporary sub-hollon 생성 가능.
Phase 4.3에서 별도 수정 없이 기존 `createTemporary` 로직 재활용 가능.

## Implementation Steps

### Step 1: Create Planning Orchestration Service

**신규 파일:** `apps/server/src/modules/planning/planning-orchestrator.service.ts`

```typescript
@Injectable()
export class PlanningOrchestratorService {
  private readonly SPECIALIST_ROLES = [
    {
      role: 'ArchitectSpecialist',
      prompt: 'Analyze architecture implications...',
      focus: ['system design', 'patterns', 'scalability'],
    },
    {
      role: 'SecurityReviewer',
      prompt: 'Identify security considerations...',
      focus: ['vulnerabilities', 'auth', 'data protection'],
    },
    {
      role: 'TestStrategist',
      prompt: 'Plan testing approach...',
      focus: ['unit tests', 'integration', 'e2e'],
    },
    {
      role: 'PerformanceAnalyst',
      prompt: 'Evaluate performance impact...',
      focus: ['bottlenecks', 'optimization', 'caching'],
    },
  ];

  async orchestratePlanning(
    parentTask: Task,
    orchestrator: Hollon,
  ): Promise<PlanningResult> {
    const analyses: SpecialistAnalysis[] = [];

    // Create and execute specialist sub-hollons
    for (const spec of this.SPECIALIST_ROLES) {
      const subHollon = await this.createPlanningSubHollon(
        orchestrator,
        spec,
        parentTask,
      );

      const analysis = await this.executeSpecialistAnalysis(
        subHollon,
        parentTask,
      );

      analyses.push(analysis);

      // Cleanup temporary sub-hollon
      await this.hollonService.deactivateTemporary(subHollon.id);
    }

    // Aggregate analyses into comprehensive plan
    return this.aggregateAnalyses(analyses, parentTask);
  }

  private async createPlanningSubHollon(
    parent: Hollon,
    spec: SpecialistSpec,
    task: Task,
  ): Promise<Hollon> {
    return this.hollonService.createTemporary(parent, {
      name: `${spec.role}-${task.id.substring(0, 8)}`,
      systemPrompt: spec.prompt,
      capabilities: ['code_analysis', 'planning'],
      disallowedTools: PLANNING_MODE_DISALLOWED_TOOLS,
    });
  }
}
```

### Step 2: Update Planning Service

**파일:** `apps/server/src/modules/planning/planning.service.ts`

```typescript
async executePlanningTask(planningTask: Task): Promise<PlanningResult> {
  // Option A: Use specialist orchestration (new)
  if (this.shouldUseOrchestration(planningTask)) {
    const orchestrator = await this.getAssignedHollon(planningTask);
    return this.planningOrchestrator.orchestratePlanning(
      parentTask,
      orchestrator,
    );
  }

  // Option B: Use single PlanningSpecialist (existing, for simple tasks)
  return this.executeSingleSpecialist(planningTask);
}

private shouldUseOrchestration(task: Task): boolean {
  // Orchestrate for complex tasks (many work items, high complexity)
  const workItemCount = this.countWorkItems(task);
  return workItemCount > 10 || task.complexity === 'HIGH';
}
```

### Step 3: Implement Analysis Aggregation

```typescript
private async aggregateAnalyses(
  analyses: SpecialistAnalysis[],
  task: Task,
): Promise<PlanningResult> {
  const planContent = `
# Implementation Plan: ${task.title}

## Executive Summary
[Generated from aggregated specialist analyses]

## Architecture Analysis
${analyses.find(a => a.role === 'ArchitectSpecialist')?.content}

## Security Considerations
${analyses.find(a => a.role === 'SecurityReviewer')?.content}

## Testing Strategy
${analyses.find(a => a.role === 'TestStrategist')?.content}

## Performance Impact
${analyses.find(a => a.role === 'PerformanceAnalyst')?.content}

## Implementation Phases
[Synthesized from all analyses]

## Risk Assessment
[Consolidated risks from all specialists]
`;

  return {
    success: true,
    planContent,
    planPath: await this.savePlanDocument(planContent, task),
  };
}
```

## Benefits

| Aspect         | Current (4.2)            | Enhanced (4.3)               |
| -------------- | ------------------------ | ---------------------------- |
| Analysis Depth | General                  | Role-specific deep analysis  |
| Timeout Risk   | High (single 10min)      | Low (parallel specialists)   |
| Coverage       | Depends on single prompt | Guaranteed multi-perspective |
| Scalability    | Limited                  | Can add more specialists     |
| Quality        | Variable                 | Consistent per domain        |

## Migration Path

1. **Phase 4.3.1**: Create `PlanningOrchestratorService` (기존 `createTemporary` 재활용)
2. **Phase 4.3.2**: Integrate with existing `PlanningService`
3. **Phase 4.3.3**: Add specialist prompts and aggregation logic
4. **Phase 4.3.4**: Testing and optimization

## Configuration

```typescript
// planning.config.ts
export const PLANNING_CONFIG = {
  orchestration: {
    enabled: true,
    minWorkItemsForOrchestration: 10,
    complexityThreshold: 'HIGH',
  },
  specialists: {
    maxConcurrent: 4,
    timeoutPerSpecialist: 180000, // 3 minutes each
    roles: ['architect', 'security', 'testing', 'performance'],
  },
};
```

## Related Files

- `apps/server/src/modules/planning/planning.service.ts` - Main planning service
- `apps/server/src/modules/orchestration/services/hollon-orchestrator.service.ts` - Existing orchestration patterns
- `apps/server/src/modules/hollon/hollon.service.ts` - Temporary hollon creation

## Status

- [x] Phase 4.2: Basic Planning Workflow (Completed)
- [ ] Phase 4.3.1: Create PlanningOrchestratorService
- [ ] Phase 4.3.2: Integrate with PlanningService
- [ ] Phase 4.3.3: Specialist prompts and aggregation
- [ ] Phase 4.3.4: Testing and optimization
