# 🚀 Phase 4 Goal API 실행 전 체크리스트

> **작성일**: 2025-12-20
> **목적**: Phase 4.1 Goal 생성 전 필수 준비 사항 확인
> **참고**: `phase4-implementation-plan.md`

---

## ❌ 현재 상태 (2025-12-20 체크 결과)

| 항목               | 상태 | 비고                           |
| ------------------ | ---- | ------------------------------ |
| Docker Compose     | ❌   | docker-compose.yml 없음        |
| OpenAI API 키      | ❌   | .env에 OPENAI_API_KEY 없음     |
| Database Migration | ❌   | 테이블 없음 (organizations 등) |
| Seed 데이터        | ❌   | Hollon, Team 등 없음           |

---

## 📋 실행 순서

### Step 1: Database Migration 실행

```bash
# 개발 환경 Migration
pnpm --filter @hollon-ai/server migration:run:dev

# 또는 전체 빌드 후 실행
pnpm build:server
NODE_ENV=development pnpm --filter @hollon-ai/server migration:run
```

**검증**:

```bash
# 테이블 생성 확인
pnpm --filter @hollon-ai/server exec psql \
  postgresql://hollon:hollon_dev_password@localhost:5432/hollon \
  -c "\dt"

# 예상 결과: organizations, teams, hollons, roles, tasks 등 테이블 목록
```

**체크리스트**:

- [ ] Migration 성공 확인
- [ ] organizations 테이블 존재 확인
- [ ] teams 테이블 존재 확인
- [ ] hollons 테이블 존재 확인
- [ ] tasks 테이블 존재 확인

---

### Step 2: Seed 데이터 실행

```bash
# Seed 실행
pnpm --filter @hollon-ai/server exec ts-node src/database/seed.ts
```

**검증**:

```bash
# Organization 확인
pnpm --filter @hollon-ai/server exec psql \
  postgresql://hollon:hollon_dev_password@localhost:5432/hollon \
  -c "SELECT name FROM organizations"

# 예상 결과: Hollon AI Development

# Team 확인
pnpm --filter @hollon-ai/server exec psql \
  postgresql://hollon:hollon_dev_password@localhost:5432/hollon \
  -c "SELECT name FROM teams"

# 예상 결과:
# - Backend Engineering
# - Data & AI Engineering
# - Backend Infrastructure

# Hollon 확인
pnpm --filter @hollon-ai/server exec psql \
  postgresql://hollon:hollon_dev_password@localhost:5432/hollon \
  -c "SELECT name FROM hollons"

# 예상 결과: 10개 Hollon
# - CTO-Zeus
# - TechLead-Alpha, Developer-Bravo, Developer-Charlie, Developer-Delta
# - AILead-Echo, DataEngineer-Foxtrot, MLEngineer-Golf
# - InfraLead-Hotel, DevOps-India
```

**체크리스트**:

- [ ] Organization "Hollon AI Development" 생성 확인
- [ ] 3개 Team 생성 확인
- [ ] 10개 Hollon 생성 확인
- [ ] Manager 설정 확인 (각 팀의 managerHollonId)

---

### Step 3: Infrastructure 설정 (Phase 4.1용)

#### 3.1 pgvector 설정 (선택 사항 - Phase 4.1 구현 후 필요)

현재는 **생략 가능**합니다. Phase 4.1 Goal을 생성하면, Hollon이 VectorSearchService를 구현할 때 pgvector가 필요하다는 것을 알고 Migration을 생성할 것입니다.

**나중에 필요 시**:

```bash
# docker-compose.yml 수정
services:
  postgres:
    image: pgvector/pgvector:pg15  # postgres:15 → pgvector/pgvector:pg15

# 컨테이너 재시작
docker-compose down
docker-compose up -d postgres
```

**체크리스트**:

- [ ] Phase 4.1 구현 시점에 pgvector 필요 여부 확인
- [ ] Hollon이 생성한 Migration에 vector 타입 포함 확인

#### 3.2 OpenAI API 키 설정 (선택 사항 - Phase 4.1 구현 후 필요)

현재는 **생략 가능**합니다. Phase 4.1 Goal을 생성하면, Hollon이 OpenAI embedding 통합 시 API 키가 필요하다는 것을 알 것입니다.

**나중에 필요 시**:

```bash
# .env 파일에 추가
echo "OPENAI_API_KEY=sk-your-api-key-here" >> .env
```

**체크리스트**:

- [ ] Phase 4.1 구현 시점에 OpenAI API 키 설정
- [ ] API 키 유효성 테스트

---

### Step 4: Phase 3 자동화 검증

#### 4.1 GoalAutomationListener Cron 확인

```bash
# 서버 실행
pnpm dev

# 로그에서 Cron 실행 확인
# 예상 로그:
# - [GoalAutomationListener] Checking for goals that need decomposition...
# - [GoalAutomationListener] Checking for tasks ready for execution...
```

**체크리스트**:

- [ ] `DISABLE_SCHEDULER` 환경 변수 없음 확인 (.env)
- [ ] 서버 로그에서 GoalAutomationListener Cron 실행 확인
- [ ] 매 1분마다 "Checking for goals..." 로그 확인

#### 4.2 Manager Hollon 설정 확인

```bash
# Manager 설정 확인
pnpm --filter @hollon-ai/server exec psql \
  postgresql://hollon:hollon_dev_password@localhost:5432/hollon \
  -c "SELECT t.name as team, h.name as manager
      FROM teams t
      JOIN hollons h ON t.\"managerHollonId\" = h.id"

# 예상 결과:
# Backend Engineering     | TechLead-Alpha
# Data & AI Engineering   | AILead-Echo
# Backend Infrastructure  | InfraLead-Hotel
```

**체크리스트**:

- [ ] Backend Engineering → TechLead-Alpha
- [ ] Data & AI Engineering → AILead-Echo
- [ ] Backend Infrastructure → InfraLead-Hotel

---

## ✅ Goal API 실행 (모든 Step 완료 후)

### Phase 4.1 Goal 생성

```bash
# HTTP 요청 (예시)
POST http://localhost:3001/api/goals
Content-Type: application/json

{
  "title": "Phase 4.1: 지식 시스템 구축",
  "description": "Task 완료 후 자동으로 지식이 축적되고, 다음 Task 실행 시 자동으로 참조되는 시스템 구현\n\n참고: docs/phases/phase4-revised-plan.md의 Phase 4.1 섹션",
  "assignedTeamId": "20762c9e-5131-4336-8ea0-f2334d03cfad",
  "assignedHollonId": "<TechLead-Alpha의 ID>",
  "acceptanceCriteria": [
    "KnowledgeExtractionService 구현 완료",
    "VectorSearchService 구현 (정확도 85%+)",
    "KnowledgeGraphService 구현 완료",
    "PromptComposerService 통합 완료",
    "E2E 테스트 90%+ 통과"
  ],
  "metadata": {
    "requiredSkills": [
      "typescript",
      "nestjs",
      "vector-databases",
      "llm-integration",
      "event-driven"
    ]
  }
}
```

**TechLead-Alpha ID 조회**:

```bash
pnpm --filter @hollon-ai/server exec psql \
  postgresql://hollon:hollon_dev_password@localhost:5432/hollon \
  -c "SELECT id, name FROM hollons WHERE name = 'TechLead-Alpha'"
```

---

## 🎯 자동 워크플로우 (Goal 생성 후)

```
T+0분  : Goal 생성 완료 (status='pending')

T+1분  : GoalAutomationListener.autoDecomposeGoals()
         └─ TechLead-Alpha가 Goal → Task 분해
            └─ Task 5개 생성 (각 팀원에게 배정)

T+2분  : GoalAutomationListener.autoExecuteTasks()
         └─ 각 Hollon이 Task 실행 시작
            ├─ Developer-Charlie: KnowledgeExtraction 구현
            ├─ DataEngineer-Foxtrot: VectorSearch 구현
            ├─ MLEngineer-Golf: PromptComposer 통합
            └─ Developer-Delta: 단위/통합 테스트

T+2시간: Task 완료 (평균)
         └─ PR 생성, CI 테스트, 코드 리뷰

T+3시간: 자동 머지
         └─ Phase 4.1 완료!
```

---

## 📊 진행 상황 모니터링

### Goal 상태 확인

```bash
# Goal 조회
pnpm --filter @hollon-ai/server exec psql \
  postgresql://hollon:hollon_dev_password@localhost:5432/hollon \
  -c "SELECT id, title, status FROM goals ORDER BY \"createdAt\" DESC LIMIT 5"
```

### Task 상태 확인

```bash
# Task 조회
pnpm --filter @hollon-ai/server exec psql \
  postgresql://hollon:hollon_dev_password@localhost:5432/hollon \
  -c "SELECT title, status, \"assignedHollonId\"
      FROM tasks
      WHERE \"parentTaskId\" IS NOT NULL
      ORDER BY \"createdAt\" DESC
      LIMIT 10"
```

### PR 확인

```bash
# GitHub PR 확인
gh pr list --state all --limit 10
```

---

## 🚨 트러블슈팅

### Migration 실패 시

```bash
# Migration 롤백
pnpm --filter @hollon-ai/server migration:revert

# 다시 실행
pnpm --filter @hollon-ai/server migration:run:dev
```

### Seed 중복 실행 시

```bash
# 기존 데이터 삭제 후 재실행
pnpm --filter @hollon-ai/server exec psql \
  postgresql://hollon:hollon_dev_password@localhost:5432/hollon \
  -c "TRUNCATE TABLE organizations CASCADE"

# Seed 재실행
pnpm --filter @hollon-ai/server exec ts-node src/database/seed.ts
```

### Cron 작동 안 할 시

```bash
# .env 확인
cat .env | grep DISABLE_SCHEDULER

# 있다면 제거
sed -i '' '/DISABLE_SCHEDULER/d' .env

# 서버 재시작
pnpm dev
```

---

## ✅ 최종 체크리스트

**필수 (지금 해야 함)**:

- [ ] Step 1: Database Migration 실행 및 검증
- [ ] Step 2: Seed 데이터 실행 및 검증 (10 Hollons)
- [ ] Step 4: GoalAutomationListener Cron 작동 확인
- [ ] Step 4: Manager 설정 확인

**선택 (Phase 4.1 구현 중 필요 시)**:

- [ ] Step 3.1: pgvector 설정 (VectorSearch 구현 시)
- [ ] Step 3.2: OpenAI API 키 설정 (Embedding 통합 시)

**Goal 생성 준비 완료**:

- [ ] 모든 필수 항목 완료
- [ ] TechLead-Alpha ID 조회 완료
- [ ] Goal JSON 준비 완료

---

**다음 단계**: 위 체크리스트 완료 후 `POST /api/goals` 실행!
