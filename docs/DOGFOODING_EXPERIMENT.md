# 🐕 Dogfooding Experiment: Hollon이 Hollon을 개발

> **실험 시작**: 2025-12-07
> **목표**: Hollon-AI 시스템이 자기 자신을 개선할 수 있는지 검증

---

## 실험 설정

### 생성된 리소스

**Organization**: `Hollon-AI Dev` (d777a292-a069-4730-8400-349a1fff8743)

**Team**: `Dogfooding Team`

- 설명: Hollon-AI로 Hollon-AI를 개발하는 팀

**Hollon**: `DevBot-1` (bd4792cd-127e-4e24-9203-4476f479ee90)

- Role: BackendEngineer
- Brain Provider: Claude Code
- Status: IDLE
- 특별 지침:
  - Hollon-AI 멀티 에이전트 시스템 개발
  - phase2-plan.md, ssot.md 참고
  - 기존 코드 스타일 준수
  - 테스트 포함 필수

**Project**: `Phase 2 Completion (Dogfooding)` (bd0b6053-1ecd-49a4-a1bf-583f7328f590)

- 설명: Hollon이 직접 Phase 2 미완성 항목 구현
- Working Directory: 현재 디렉토리

**Task**: `StandupService에 getActiveTeamHollons 헬퍼 메서드 추가` (1b873e90-2603-4339-b771-504437b1c0a1)

- Status: IN_PROGRESS
- Priority: P2 (High)
- Assigned to: DevBot-1
- Started at: 2025-12-07T15:11:00.457Z

---

## Quick Test Task 상세

### 목표

StandupService 클래스에 private 헬퍼 메서드 추가

### 구현할 메서드

```typescript
/**
 * 팀의 활성 홀론 목록 조회
 * @param teamId 팀 ID
 * @returns 활성 상태(IDLE, WORKING)인 홀론 배열
 */
private async getActiveTeamHollons(teamId: string): Promise<Hollon[]> {
  return this.hollonRepo.find({
    where: {
      teamId,
      status: In([HollonStatus.IDLE, HollonStatus.WORKING])
    },
    relations: ['role'],
  });
}
```

### 완료 기준

- ✅ TypeScript 컴파일 에러 없음
- ✅ 메서드가 올바른 위치에 추가됨
- ✅ import 구문이 올바르게 추가됨

---

## 실험 진행 상황

### 2025-12-07 오후 11:11 - 초기 설정 완료

**완료**:

- ✅ Seed 데이터 확장 (Dogfooding 전용)
- ✅ DevBot-1 Hollon 생성
- ✅ Quick Test Task 생성 및 할당
- ✅ 서버 실행 중
- ✅ PostgreSQL LISTEN 연결 성공

**다음 단계**:

1. HollonOrchestrator가 Task를 자동 감지하는지 확인
2. DevBot-1의 실행 로그 모니터링
3. StandupService 파일 변경사항 확인
4. 결과 분석

---

## 모니터링 명령어

```bash
# Task 상태 확인
curl http://localhost:3001/api/tasks/1b873e90-2603-4339-b771-504437b1c0a1

# Hollon 상태 확인
curl http://localhost:3001/api/hollons/bd4792cd-127e-4e24-9203-4476f479ee90

# 서버 로그 확인
# 백그라운드 프로세스 로그 참조

# 파일 변경사항 확인
git status
git diff src/modules/meeting/services/standup.service.ts
```

---

## 예상 결과

### ✅ 성공 시나리오 (30%)

- DevBot-1이 Task를 pull
- Claude Code 실행하여 메서드 추가
- 컴파일 에러 없이 완료
- Task 상태 → COMPLETED
- 파일에 정확한 코드 추가됨

**→ 학습**: "실제로 작동한다!" → 더 복잡한 Task 시도

### 🟡 부분 성공 시나리오 (40%)

- DevBot-1이 Task 실행
- 코드 추가했으나 위치/형식 이상
- 또는 컴파일 에러 발생

**→ 학습**:

- 프롬프트 개선 필요
- Task 설명 더 명확히
- Quality Gate 강화

### ❌ 실패 시나리오 (30%)

- DevBot-1이 Task를 감지 못함
- 또는 실행 중 에러/크래시
- 또는 엉뚱한 코드 생성

**→ 학습**:

- Orchestrator 로직 점검
- Brain Provider 설정 확인
- 에러 핸들링 개선
- 프롬프트 합성 검증

---

## 결과 (2025-12-08 완료)

### 실행 결과: ✅ 성공!

DevBot-1이 `StandupService`의 `getActiveTeamHollons` 메서드를 성공적으로 개선했습니다.

**변경사항 (git diff)**:

```typescript
// Before (문제 있는 코드):
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Hollon } from '../../hollon/entities/hollon.entity';

private async getActiveTeamHollons(teamId: string): Promise<Hollon[]> {
  return this.hollonRepo.find({
    where: {
      teamId,
      status: 'idle' as any,  // 타입 안전하지 않음
    },
  });
}

// After (DevBot-1이 수정한 코드):
import { Repository, MoreThanOrEqual, In } from 'typeorm';
import { Hollon, HollonStatus } from '../../hollon/entities/hollon.entity';

/**
 * 팀의 활성 홀론 목록 조회
 * @param teamId 팀 ID
 * @returns 활성 상태(IDLE, WORKING)인 홀론 배열
 */
private async getActiveTeamHollons(teamId: string): Promise<Hollon[]> {
  return this.hollonRepo.find({
    where: {
      teamId,
      status: In([HollonStatus.IDLE, HollonStatus.WORKING]),
    },
    relations: ['role'],
  });
}
```

**코드 품질 분석**:
| 항목 | 개선 내용 |
|------|----------|
| 타입 안전성 | `'idle' as any` → `HollonStatus.IDLE` enum 사용 |
| 로직 정확성 | IDLE만 → IDLE + WORKING (더 정확한 "활성" 정의) |
| 관계 로딩 | `relations: ['role']` 추가 |
| 문서화 | 한국어 JSDoc 주석 추가 |

**검증 결과**:

- ✅ TypeScript 컴파일 에러 없음
- ✅ NestJS 빌드 성공
- ✅ 메서드가 올바른 위치에 추가됨
- ✅ import 구문이 올바르게 추가됨

### 발견한 문제

1. **데이터 영속성 (Critical)**
   - 문제: `dropSchema: !isProduction` 설정으로 서버/스크립트 재시작 시 모든 데이터 삭제
   - 해결: `dropSchema: false`로 변경 완료

2. **Task 할당 로직**
   - 문제: TaskPoolService의 `findDirectlyAssignedTask`가 `READY`/`PENDING` 상태만 조회
   - 영향: 수동으로 `in_progress`로 변경 시 Task를 찾지 못함
   - 해결: 수동으로 Task 상태를 `ready`로 리셋 후 실행

3. **Task 우선순위 충돌**
   - 문제: Team 기반 task 검색이 다른 프로젝트의 task를 반환
   - 해결: 명시적으로 DevBot-1에게 task 할당

### 개선 방향

1. **Task 할당 플로우 개선**
   - 직접 할당된 task의 상태 자동 관리
   - 할당 시 상태를 `READY`로 자동 설정

2. **데이터베이스 설정 안정화**
   - 개발 환경에서도 `dropSchema: false` 유지
   - 마이그레이션 기반 스키마 관리로 전환

3. **모니터링 강화**
   - Task 실행 로그 저장 및 조회 기능
   - Hollon 실행 히스토리 추적

### 다음 실험

**Phase 2: 더 복잡한 코딩 Task**

후보 작업들:

1. **Unit Test 작성**: StandupService에 대한 테스트 파일 생성
2. **새로운 API 엔드포인트 추가**: 간단한 CRUD 작업
3. **기존 코드 리팩토링**: 코드 품질 개선 작업
4. **버그 수정**: 실제 이슈 해결

**권장 다음 실험**: StandupService Unit Test 작성

- 이유: 이미 StandupService 코드를 수정했으므로 해당 파일에 대한 이해도가 높음
- 복잡도: 중간 (새 파일 생성 + 기존 코드 참조)
- 검증 용이: Jest 테스트 실행으로 즉시 검증 가능

---

## 관련 파일

- Seed 스크립트: `/apps/server/src/database/seed.ts`
- 할당 스크립트: `/apps/server/src/scripts/assign-dogfooding-task.ts`
- 대상 파일: `/apps/server/src/modules/meeting/services/standup.service.ts`
- Task 엔티티: `/apps/server/src/modules/task/entities/task.entity.ts`
- Orchestrator: `/apps/server/src/modules/orchestration/hollon-orchestrator.service.ts`
