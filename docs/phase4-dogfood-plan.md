# 🚀 Phase 4: 지식 시스템 자율 실행 가이드

> **작성일**: 2025-12-10
> **최종 수정**: 2025-12-10
> **목표**: Phase 4 (지식 시스템 및 자기 개선)를 Manager Hollon이 팀원에게 자율 분배하여 완전 자동 실행
>
> ⚠️ **이 문서는 phase4-execution-guide.md를 통합하여 대체합니다**

---

## 📖 목차

1. [3단계 빠른 실행](#-3단계-빠른-실행-5분)
2. [상세 실행 절차](#-상세-실행-절차)
3. [전체 워크플로우 이해](#-전체-워크플로우-이해)
4. [모니터링 및 트러블슈팅](#-모니터링-및-트러블슈팅)
5. [Phase 4 계획 및 타임라인](#-phase-4-계획-및-타임라인)
6. [성공 기준 및 검증](#-성공-기준-및-검증)

---

## ⚡ 3단계 빠른 실행 (5분)

### 전제 조건 확인

```bash
# Phase 3.8 완료 확인
pnpm --filter @hollon-ai/server test:integration

# 필수 조건:
# ✅ Phase 3.8 (TeamTaskDistributionService + Manager)
# ✅ Phase 3.7 (HollonExecutionService 완전 자율 실행)
# ✅ Phase 3.5 (자율 코드 리뷰, PR 자동 병합)
# ✅ Document/Memory 인프라 (pgvector)
```

### Step 1: DB Seed + 서버 시작 (2분)

```bash
# Terminal 1: DB Seed (Manager + Phase 4 Team 자동 생성)
pnpm --filter @hollon-ai/server db:seed

# 생성되는 Hollon:
# ✅ Manager-Knowledge (Phase 4 Knowledge Team의 Manager)
# ✅ DevBot-AI (팀원: NLP, embedding, vector 전문)
# ✅ DevBot-Data (팀원: graph, database 전문)
# ✅ DevBot-Backend (팀원: TypeScript, NestJS 전문)
# ✅ ReviewBot-QA (팀원: testing 전문)

# Terminal 1: 서버 시작
pnpm --filter @hollon-ai/server dev
```

### Step 2: Goal 생성 (1분)

```bash
# Terminal 2: Organization ID 조회
ORG_ID=$(curl -s http://localhost:3001/organizations | jq -r '.[0].id')
echo "Organization ID: $ORG_ID"

# Phase 4 Goal 생성
GOAL=$(curl -s -X POST http://localhost:3001/goals \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "'$ORG_ID'",
    "title": "Phase 4: 지식 시스템 및 자기 개선",
    "description": "홀론이 경험에서 학습하고 프롬프트를 최적화하는 시스템 구축. Week 1-2: KnowledgeExtraction, VectorSearch, KnowledgeGraph. Week 3-4: PerformanceAnalyzer, PromptOptimizer, BestPractice.",
    "goalType": "project",
    "priority": "high",
    "targetDate": "2025-01-10"
  }')

GOAL_ID=$(echo $GOAL | jq -r '.id')
echo "✅ Goal ID: $GOAL_ID"
```

### Step 3: 자동 분해 + Manager 분배 (2분)

```bash
# Goal Decomposition with Team Distribution
curl -X POST "http://localhost:3001/goals/$GOAL_ID/decompose" \
  -H "Content-Type: application/json" \
  -d '{
    "maxTasks": 30,
    "preferredComplexity": "medium",
    "useTeamDistribution": true
  }' | jq .

# Project ID 조회
PROJECT_ID=$(curl -s http://localhost:3001/projects | \
  jq -r '.[] | select(.name | contains("Phase 4")) | .id')

echo "✅ Project ID: $PROJECT_ID"

# 30초 대기 (HollonExecutionService가 자동 분배)
echo "⏳ Manager가 Team Task를 팀원에게 분배 중... (30초)"
sleep 30

# 분배 결과 확인
echo "\n📋 팀원별 Task 분배 현황:"
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID" | \
  jq 'group_by(.assignedHollon.name) | map({hollon: .[0].assignedHollon.name, tasks: length})'
```

### 🎉 완료! 이제 완전 자동 실행됩니다

```bash
# 실시간 진행 상황 모니터링
watch -n 10 "curl -s http://localhost:3001/tasks?projectId=$PROJECT_ID | \
  jq 'group_by(.status) | map({status: .[0].status, count: length})'"
```

**다음 단계**: [모니터링 및 트러블슈팅](#-모니터링-및-트러블슈팅)으로 이동

---

## 📚 상세 실행 절차

### 🔍 Phase 3.8 자동 분배 메커니즘 이해

**완전 자율 실행 워크플로우:**

```
Goal 생성 (인간, 1회만)
    ↓
useTeamDistribution: true
    ↓
GoalDecompositionService
    → 3-7개 Team Task 생성 (TEAM_EPIC, depth=0)
    → Phase 4 Knowledge Team에 할당
    → status: PENDING
    ↓
[매 30초] HollonExecutionService.distributeTeamTasks()
    → PENDING Team Task 자동 감지
    → TeamTaskDistributionService.distributeToTeam() 호출
    ↓
Manager-Knowledge (Brain Provider AI 판단)
    → 팀원 스킬 분석 (DevBot-AI, DevBot-Data, etc.)
    → 현재 워크로드 확인
    → 3-7개 Hollon Task 생성 (depth=1)
    → 각 Task를 적절한 팀원에게 할당
    → status: READY
    → Team Task status: IN_PROGRESS
    ↓
[매 10초] HollonExecutionService.executeAssignedHollons()
    → IDLE Hollon + READY Task 자동 감지
    → HollonOrchestrator.runCycle() 호출
    ↓
Task 실행 (완전 자동)
    → Git Worktree 생성
    → Brain Provider 실행 (코딩)
    → git commit + push
    → gh pr create (자동 PR 생성)
    ↓
[1분 후] MessageListener
    → CodeReviewService 자동 실행
    → AutoMergeService (승인 시 자동 병합)
    ↓
Task 완료 → Hollon IDLE
    ↓
[10초 후] 다음 Task 자동 시작 (반복)
```

### 🎯 API 호출 가이드 (인간이 실행)

#### 1️⃣ 초기 설정 확인

```bash
# Organization 확인
curl -s http://localhost:3001/organizations | jq '.[0] | {id, name}'

# Phase 4 Team 확인
ORG_ID="<your-org-id>"
curl -s "http://localhost:3001/teams?organizationId=$ORG_ID" | \
  jq '.[] | select(.name == "Phase 4 Knowledge Team") | {id, name, managerHollonId}'

# Manager Hollon 확인
TEAM_ID="<phase4-team-id>"
curl -s "http://localhost:3001/teams/$TEAM_ID" | \
  jq '{manager: .manager.name, members: [.members[].name]}'
```

#### 2️⃣ Goal 생성 (POST /goals)

```bash
ORG_ID="<your-org-id>"

curl -X POST http://localhost:3001/goals \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "'$ORG_ID'",
    "title": "Phase 4: 지식 시스템 및 자기 개선",
    "description": "홀론이 경험에서 학습하고 프롬프트를 최적화하는 시스템 구축. Week 1-2: KnowledgeExtraction, VectorSearch, KnowledgeGraph. Week 3-4: PerformanceAnalyzer, PromptOptimizer, BestPractice.",
    "goalType": "project",
    "priority": "high",
    "targetDate": "2025-01-10",
    "successCriteria": [
      "Task 완료 후 Document 자동 생성 (100%)",
      "Vector similarity search 정확도 85%+",
      "동일 Task 5회 수행 시 효율성 20% 향상",
      "Prompt 최적화로 토큰 15% 절감"
    ]
  }'
```

#### 3️⃣ Goal Decomposition (POST /goals/:id/decompose)

```bash
GOAL_ID="<goal-id-from-step-2>"

curl -X POST "http://localhost:3001/goals/$GOAL_ID/decompose" \
  -H "Content-Type: application/json" \
  -d '{
    "maxTasks": 30,
    "preferredComplexity": "medium",
    "useTeamDistribution": true
  }'

# 응답 예시:
# {
#   "goalId": "...",
#   "projectId": "...",
#   "teamTasksCreated": 5,
#   "teamTasks": [
#     {
#       "id": "...",
#       "title": "Week 1-2: Knowledge Extraction System",
#       "type": "team_epic",
#       "assignedTeamId": "...",
#       "status": "pending"
#     },
#     ...
#   ]
# }
```

#### 4️⃣ 자동 실행 대기 (API 호출 불필요!)

```bash
# 30초 대기 - HollonExecutionService가 Team Task 자동 분배
echo "⏳ Waiting for automatic distribution (30 seconds)..."
sleep 30

# Hollon Task 확인
PROJECT_ID="<project-id-from-step-3>"
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID&depth=1" | \
  jq '.[] | {title, assignedHollon: .assignedHollon.name, status}'
```

#### 5️⃣ Emergency Stop (긴급 중단 필요 시)

```bash
# 자율 실행 중단
curl -X POST "http://localhost:3001/organizations/$ORG_ID/emergency-stop" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Phase 4 setup verification needed"
  }'

# 실행 재개
curl -X POST "http://localhost:3001/organizations/$ORG_ID/resume-execution"
```

---

## 🔍 전체 워크플로우 이해

### Phase 3.8 Manager 기반 분배

**Manager-Knowledge가 하는 일:**

1. **팀원 스킬 분석**

   ```typescript
   // TeamTaskDistributionService.distributeToTeam()
   const teamMembers = await this.getTeamMembers(teamTask.assignedTeamId);

   // Brain Provider에 전달되는 정보:
   {
     teamMembers: [
       { name: "DevBot-AI", skills: ["nlp", "embedding", "vector"], workload: 2 },
       { name: "DevBot-Data", skills: ["graph", "database"], workload: 1 },
       { name: "DevBot-Backend", skills: ["typescript", "nestjs"], workload: 3 },
       { name: "ReviewBot-QA", skills: ["testing"], workload: 1 }
     ],
     teamTask: {
       title: "Week 1-2: Knowledge Extraction System",
       description: "KnowledgeExtraction, VectorSearch, KnowledgeGraph 구현"
     }
   }
   ```

2. **Manager AI 판단**
   - Brain Provider (Claude Code)가 최적 할당 결정
   - 스킬 매칭 + 워크로드 밸런싱
   - 의존성 고려 (순차/병렬 실행)

3. **Hollon Task 생성**
   ```typescript
   // Manager가 생성하는 Task 예시:
   [
     {
       title: 'KnowledgeExtractionService 기본 구조',
       assignedHollonId: 'DevBot-AI',
       dependencies: [],
       status: 'ready',
     },
     {
       title: 'VectorSearchService 구현',
       assignedHollonId: 'DevBot-AI',
       dependencies: ['KnowledgeExtractionService'],
       status: 'blocked', // 의존성 대기
     },
     {
       title: 'KnowledgeGraphService 구현',
       assignedHollonId: 'DevBot-Data',
       dependencies: [],
       status: 'ready',
     },
   ];
   ```

### Hollon 자율 실행

**DevBot-AI가 Task 실행하는 과정:**

```bash
1. HollonExecutionService.executeAssignedHollons() (매 10초)
   → DevBot-AI: IDLE + Task "KnowledgeExtractionService" READY

2. HollonOrchestrator.runCycle(DevBot-AI)
   → TaskExecutionService.executeTask()

3. Git Worktree 생성
   → git worktree add ../task-xxx feature/task-xxx

4. Brain Provider 실행
   → Prompt 합성 (Organization → Team → Role → Hollon → Memory → Task)
   → Claude Code 실행
   → 코드 작성 + 테스트
   → git commit -m "feat: KnowledgeExtractionService 구현"

5. PR 생성
   → git push origin feature/task-xxx
   → gh pr create --title "..." --body "..."

6. Task 상태 업데이트
   → status: IN_PROGRESS → COMPLETED
   → DevBot-AI: WORKING → IDLE

7. MessageListener (1분 후)
   → CodeReviewService 자동 실행
   → AutoMergeService (CI 통과 + 승인 시)

8. 다음 Task 자동 시작
   → 10초 후 executeAssignedHollons() 다시 실행
   → DevBot-AI가 다음 READY Task pull
```

---

## 📊 모니터링 및 트러블슈팅

### 실시간 모니터링

#### 1️⃣ Dashboard 확인

```bash
PROJECT_ID="<your-project-id>"

# Task 상태별 통계
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID" | \
  jq 'group_by(.status) | map({status: .[0].status, count: length})'

# Hollon별 Task 분배 현황
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID" | \
  jq 'group_by(.assignedHollon.name) | map({hollon: .[0].assignedHollon.name, tasks: length})'

# 진행 중인 Task
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID&status=in_progress" | \
  jq '.[] | {title, hollon: .assignedHollon.name, startedAt}'
```

#### 2️⃣ Hollon 상태 확인

```bash
ORG_ID="<your-org-id>"

curl -s "http://localhost:3001/hollons?organizationId=$ORG_ID" | \
  jq '.[] | {name, status, tasksCompleted: (.tasksCompleted // 0), tasksInProgress: (.tasksInProgress // 0)}'
```

#### 3️⃣ PR 및 Code Review 확인

```bash
# GitHub PR 목록
gh pr list --label "phase-4"

# PR 상태 상세
gh pr view <PR-NUMBER>
```

#### 4️⃣ 블로커 감지

```bash
# BLOCKED Task 확인
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID&status=blocked" | \
  jq '.[] | {title, reason: .blockedReason, dependencies: [.dependencies[].title]}'

# Stuck Task 확인 (2시간 이상 IN_PROGRESS)
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID&status=in_progress" | \
  jq '.[] | select(.startedAt | fromdateiso8601 < (now - 7200)) | {title, startedAt, duration: ((now - (.startedAt | fromdateiso8601)) / 3600 | floor)}'
```

### 트러블슈팅

#### ❌ "Team Task가 분배되지 않음"

**증상:**

```bash
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID&type=team_epic" | \
  jq '.[] | {title, status}'
# 결과: status가 계속 "pending"
```

**원인:**

- Team에 Manager가 할당되지 않음
- Manager Hollon이 IDLE 상태가 아님

**해결:**

```bash
# 1. Manager 확인
TEAM_ID="<phase4-team-id>"
curl -s "http://localhost:3001/teams/$TEAM_ID" | jq '.managerHollonId'

# 2. Manager 없으면 DB re-seed
pnpm --filter @hollon-ai/server db:seed

# 3. Manager 상태 확인
MANAGER_ID="<manager-hollon-id>"
curl -s "http://localhost:3001/hollons/$MANAGER_ID" | jq '.status'
```

#### ❌ "Manager 분배 실패 (Brain Provider 에러)"

**증상:**

```bash
# 로그에 에러 발생
tail -f logs/app.log | grep "TeamTaskDistributionService"
# 결과: "Failed to parse Brain Provider response"
```

**원인:**

- Manager system prompt가 잘못됨
- Brain Provider JSON 응답 파싱 실패

**해결:**

```bash
# 1. Manager Role 확인
curl -s "http://localhost:3001/roles" | \
  jq '.[] | select(.name == "Manager") | {systemPrompt, capabilities}'

# 2. Team Task 수동 재시도
TEAM_TASK_ID="<team-task-id>"
curl -X POST "http://localhost:3001/tasks/$TEAM_TASK_ID/retry"
```

#### ❌ "Hollon Task가 실행 안 됨"

**증상:**

```bash
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID&depth=1" | \
  jq '.[] | {title, status, assignedHollon: .assignedHollon.name}'
# 결과: status가 "pending" 또는 "blocked"
```

**원인:**

- Task status가 READY가 아님
- Hollon이 IDLE 상태가 아님
- 의존성 미완료

**해결:**

```bash
# 1. Task 의존성 확인
TASK_ID="<task-id>"
curl -s "http://localhost:3001/tasks/$TASK_ID" | \
  jq '{title, status, dependencies: [.dependencies[] | {title, status}]}'

# 2. Hollon 상태 확인
HOLLON_ID="<hollon-id>"
curl -s "http://localhost:3001/hollons/$HOLLON_ID" | \
  jq '{name, status, currentTaskId}'

# 3. Task 수동 READY 전환 (의존성 완료된 경우)
curl -X PATCH "http://localhost:3001/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -d '{"status": "ready"}'
```

#### ❌ "Worktree creation failed"

**증상:**

```bash
# 로그 에러
tail -f logs/app.log | grep "worktree"
# 결과: "fatal: 'task-xxx' is already checked out"
```

**해결:**

```bash
# 1. 기존 worktree 확인
git worktree list

# 2. 강제 제거
git worktree remove --force ../task-xxx

# 3. Task 재시도
curl -X POST "http://localhost:3001/tasks/$TASK_ID/retry"
```

#### ❌ "gh pr create failed"

**증상:**

```bash
# 로그 에러
tail -f logs/app.log | grep "gh pr"
# 결과: "error: could not create pull request"
```

**해결:**

```bash
# 1. GitHub CLI 인증 확인
gh auth status

# 2. 재인증
gh auth login

# 3. 권한 확인
gh auth refresh -s repo,workflow
```

### 안전장치 활용

#### Emergency Stop (모든 자율 실행 중단)

```bash
ORG_ID="<your-org-id>"

# 중단
curl -X POST "http://localhost:3001/organizations/$ORG_ID/emergency-stop" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Critical bug detected in KnowledgeExtractionService"
  }'

# 상태 확인
curl -s "http://localhost:3001/organizations/$ORG_ID" | \
  jq '.settings | {autonomousExecutionEnabled, emergencyStopReason}'

# 재개
curl -X POST "http://localhost:3001/organizations/$ORG_ID/resume-execution"
```

#### Exponential Backoff (실패 Task 자동 복구)

```bash
# 실패 Task 확인
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID&status=failed" | \
  jq '.[] | {title, consecutiveFailures, blockedUntil, errorMessage}'

# Backoff 스케줄:
# 1회 실패 → 5분 후 재시도
# 2회 실패 → 15분 후 재시도
# 3회 실패 → 1시간 후 재시도 (최대)
```

---

## 📋 Executive Summary

### Phase 4 핵심 목표

**홀론이 경험에서 학습하고 프롬프트를 스스로 최적화**

```
Week 1-2: Knowledge Extraction & Vector RAG
  - Task 완료 시 자동 Document 생성
  - Vector similarity search 활성화
  - Knowledge Graph (document_relationships)

Week 3-4: Self-Improvement Loop
  - 성과 분석 (PerformanceAnalyzer)
  - Prompt 최적화 (PromptOptimizer)
  - 패턴 학습 (BestPracticeService)
```

### 예상 성과

| 지표                  | Phase 3.5 | Phase 3.7 목표 | Phase 4 예상  |
| --------------------- | --------- | -------------- | ------------- |
| **자율성**            | 85%       | 100% ✅        | 100% ✅       |
| **Phase 4 소요 기간** | N/A       | N/A            | 4-5주         |
| **인간 개입**         | Task마다  | Goal 1회만 ✅  | 주 6-8시간 ✅ |
| **성공 확률**         | N/A       | N/A            | 85% (현실적)  |
| **코드 품질**         | A급       | A급            | A급           |
| **추가 테스트**       | N/A       | N/A            | 120-150       |

---

## 🎯 왜 이 Phase 4인가?

### 기존 Blueprint Phase 4의 문제점

#### ❌ Week 19-20: OnboardingService, SkillMatrixService

```
문제:
1. 인간 조직을 모방 (온보딩, 스킬 레벨)
2. AI에게 "온보딩"은 의미 없음
   - Prompt 설정만으로 즉시 기능
   - junior/senior는 프롬프트 차이일 뿐
3. "스킬"은 Role의 capabilities에 이미 정의됨
   - 중복 개념
   - 관리 오버헤드만 증가

→ 본질을 놓침: AI는 Document/Memory로 "학습"한다
```

### ✅ 수정된 Phase 4: 지식 시스템 중심

#### 핵심 통찰

```
AI 홀론의 "성장" 메커니즘:

Layer 1-4 (Organization/Team/Role/Hollon):
  - 정적 설정
  - 인간이 설계

Layer 5 (Memory/Documents):
  - 동적 지식
  - 실행 중 학습
  - Task 완료 → Document 생성 → 다음 Task에 자동 주입

→ 이것이 진짜 "학습"이다!
```

#### 현재 구현 vs 목표

**✅ 이미 구현된 것 (Phase 3.5까지)**:

1. **Document Entity** (apps/server/src/modules/document/entities/document.entity.ts:14-75)
   - title, content, type, tags, metadata
   - scope: organization/team/project/hollon
   - embedding: vector(1536) (pgvector 준비완료)
   - DocumentType: TASK_CONTEXT, DECISION_LOG, KNOWLEDGE, DISCUSSION, CODE_REVIEW

2. **DocumentService** (apps/server/src/modules/document/document.service.ts:18-195)
   - CRUD, 스코프별 검색
   - findOrganizationKnowledge, findProjectDocuments
   - searchByTags, findByHollon, findByTask

3. **PromptComposerService Layer 5** (apps/server/src/modules/orchestration/services/prompt-composer.service.ts)
   - `fetchRelevantMemories` (176-247): 키워드 기반 검색 (ILIKE)
   - `composeMemoryLayer` (297-315): 문서를 프롬프트에 주입
   - 한계: Vector similarity 미사용, 자동 생성 없음

**🔨 구현 필요한 것 (Phase 4)**:

**Week 1-2: Knowledge Extraction & Vector RAG**

```typescript
1. KnowledgeExtractionService
   - Task 완료 후 자동 Document 생성
   - DecisionLog → memory document
   - PR 리뷰 결과 → CODE_REVIEW document
   - Meeting 결과 → DISCUSSION document

2. VectorSearchService (Vector RAG)
   - OpenAI embedding API 호출 (embedding 필드 활용)
   - Cosine similarity search (pgvector)
   - PromptComposerService 통합 (ILIKE → Vector search)

3. KnowledgeGraphService
   - document_relationships 테이블 생성
   - 문서 간 관계 추적 (references, depends_on, supersedes, related_to)
   - Graph traversal for context expansion
```

**Week 3-4: Self-Improvement Loop**

```typescript
4. PerformanceAnalyzer
   - Task 성과 메트릭 수집
     * 완료 시간 vs 예상 시간
     * 에스컬레이션 발생 여부
     * PR 리뷰 피드백 품질
   - Hollon별, Role별 성과 통계

5. PromptOptimizer
   - 성과 데이터 기반 Prompt 조정 제안
   - A/B 테스트 프레임워크
   - Layer 1-4 (Organization/Team/Role/Hollon) 최적화

6. BestPracticeService
   - 고성과 Task에서 패턴 추출
   - "베스트 프랙티스" Document 자동 생성
   - 패턴 학습 및 재사용

(선택) ExternalKnowledgeService
   - GitHub API 연동 (코드베이스 검색)
   - 외부 API 문서 크롤링
```

---

## 🗓️ Phase 4 계획 및 타임라인

### Phase 3.5: 완료됨 ✅

**완료된 기능**:

- ✅ 자율 코드 리뷰 (CodeReviewerService)
- ✅ PR 자동 병합 (AutoMergeService)
- ✅ 목표 분해 통합 (GoalDecompositionService + EscalationService)
- ✅ Message 기반 자동 작업 시작 (MessageListener)

**인프라 준비**:

- ✅ Document Entity with pgvector
- ✅ DocumentService with scope-based search
- ✅ PromptComposerService Layer 5 (키워드 기반)

---

### Phase 4: 홀론 주도 (4-5주)

#### Week 0: 프로젝트 킥오프 (인간 주도, 1일)

**Step 1: Phase 4 Goal 생성 (30분)**

```bash
# CLI 사용
claude -p --output-format text <<EOF
Create a Goal for Phase 4:

Title: "Phase 4: 지식 시스템 및 자기 개선"
Description: "홀론이 경험에서 학습하고, 프롬프트를 스스로 최적화하는 시스템 구축"
Type: project
Priority: high

Success Criteria:
1. Task 완료 후 Document 자동 생성 (100%)
2. Vector similarity search 작동 (정확도 85%+)
3. 동일 Task 5회 수행 시 효율성 20% 향상
4. Prompt 최적화로 토큰 사용량 15% 절감

Key Results:
1. KnowledgeExtractionService 구현 (Week 1-2)
2. VectorSearchService 구현 (Week 1-2)
3. KnowledgeGraphService 구현 (Week 1-2)
4. PerformanceAnalyzer 구현 (Week 3-4)
5. PromptOptimizer 구현 (Week 3-4)
6. BestPracticeService 구현 (Week 3-4)

Target Date: 2025-12-31 (4주 후)
EOF
```

**Step 2: 자동 목표 분해 실행 (GoalDecompositionService)**

```typescript
// GoalDecompositionService가 자동으로 실행됨 (이미 Phase 3.5에서 통합)

Input: Phase 4 Goal ID

자동 실행:
1. Blueprint.md Week 21-24 분석 (온보딩 제외)
2. 현재 구현 상태 분석 (Document/DocumentService/PromptComposer)
3. Brain Provider 호출:
   Prompt: "다음 목표를 실행 가능한 Task로 분해해줘:
            {goal.description}

            기존 인프라:
            - Document Entity with embedding vector(1536)
            - DocumentService with CRUD + scope search
            - PromptComposerService with fetchRelevantMemories (ILIKE)

            구현 필요:
            - Week 1-2: KnowledgeExtraction, VectorSearch, KnowledgeGraph
            - Week 3-4: PerformanceAnalyzer, PromptOptimizer, BestPractice

            각 Task는:
            - 명확한 목표 (Acceptance Criteria)
            - 예상 복잡도 (LOW/MEDIUM/HIGH)
            - 필요 스킬
            - 예상 소요 시간 (4시간 이하 권장)"

4. Task 생성 (예상 25-30개):

Week 1-2 (Knowledge 시스템):
  Task 1: KnowledgeExtractionService 기본 구조 (MEDIUM)
  Task 2: extractFromCompletedTask 메서드 구현 (MEDIUM)
  Task 3: extractKeywords 메서드 구현 (LOW)
  Task 4: generateDocumentFromDecisionLog (LOW)
  Task 5: VectorSearchService 기본 구조 (LOW)
  Task 6: OpenAI embedding API 연동 (MEDIUM)
  Task 7: generateEmbedding 메서드 구현 (LOW)
  Task 8: vectorSimilaritySearch 메서드 구현 (MEDIUM)
  Task 9: PromptComposerService 통합 (Vector search) (MEDIUM)
  Task 10: KnowledgeGraphService 기본 구조 (LOW)
  Task 11: DocumentRelationship Entity 생성 (LOW)
  Task 12: extractRelationships 메서드 구현 (MEDIUM)
  Task 13: findRelatedDocuments 메서드 구현 (LOW)
  Task 14-18: 각 서비스 단위 테스트 (LOW)
  Task 19: E2E 테스트 (Knowledge 플로우) (MEDIUM)

Week 3-4 (자기 개선):
  Task 20: HollonPerformanceSummary Entity 확장 (LOW)
  Task 21: PerformanceAnalyzer 기본 구조 (LOW)
  Task 22: analyzeTaskCompletion 메서드 구현 (MEDIUM)
  Task 23: calculateProductivityScore (MEDIUM)
  Task 24: PromptOptimizer 기본 구조 (LOW)
  Task 25: analyzePromptEffectiveness (HIGH)
  Task 26: suggestPromptOptimizations (HIGH)
  Task 27: BestPracticeService 기본 구조 (LOW)
  Task 28: extractPatternsFromHighPerformance (MEDIUM)
  Task 29: generateBestPracticeDocument (LOW)
  Task 30-34: 각 서비스 단위 테스트 (LOW)
  Task 35: E2E 테스트 (자기 개선 플로우) (MEDIUM)

5. DependencyAnalyzer 자동 실행:
   Task 2-4 → Task 1 완료 후
   Task 9 → Task 6-8 완료 후
   Task 12-13 → Task 11 완료 후
   Task 22-23 → Task 21 완료 후
   ...

6. ResourcePlanner 자동 실행:
   Task 1-9: DevBot-AI (skills: nlp, embedding, vector)
   Task 10-13: DevBot-Data (skills: graph, database)
   Task 14-19, 30-35: DevBot-QA (skills: testing)
   Task 20-29: DevBot-Backend (skills: typescript, nestjs, analytics)
   All Tasks: DevBot-Senior (reviewer)

Output:
  ✅ Project 생성: "Phase 4: 지식 시스템 및 자기 개선"
  ✅ 30개 Task 생성 (dependency graph)
  ✅ 5명 Hollon 자동 할당
  ✅ Sprint 1-2 자동 계획
```

**Step 3: 인간 검토 및 조정 (1-2시간)**

```
검토 항목:
✅ Task 분해가 합리적한가?
✅ 의존성이 정확한가?
✅ Hollon 할당이 적절한가?
✅ 우선순위가 올바른가?

조정 (필요 시):
- Task 병합/분리
- 의존성 추가/제거
- 할당 재조정
- 우선순위 변경

승인:
→ Phase 4 Sprint 1 시작! 🚀
```

---

#### Week 1-2: Knowledge 시스템 구현 (홀론 주도)

**일일 루틴 (자동)**

```
09:00 - StandupService 실행
  ✅ 각 Hollon 어제/오늘/블로커 수집
  ✅ 팀 채널에 요약 게시
  ✅ 블로커 있으면 PriorityRebalancer 트리거

09:30-17:00 - Task 자율 실행
  DevBot-AI 예시 (Task 1: KnowledgeExtractionService):
    1. Task Pull (highest priority + assigned to me)
    2. Task 상태 → IN_PROGRESS
    3. 기존 코드 분석:
       - DocumentService 패턴 참조
       - TaskService 완료 훅 확인
       - DecisionLog 구조 파악
    4. 코드 작성:
       src/modules/knowledge/services/knowledge-extraction.service.ts
       - extractFromCompletedTask(task: Task): Promise<Document>
       - extractKeywords(text: string): string[]
       - generateSummary(task: Task): Promise<string>
    5. 테스트 작성:
       src/modules/knowledge/services/knowledge-extraction.service.spec.ts
       - 15+ test cases
    6. PR 생성:
       Title: "feat(knowledge): KnowledgeExtractionService 구현"
       Reviewer: DevBot-Senior (자동)
    7. DecisionLog 기록:
       Decision: "Task 완료 시점에 어디서 호출?"
       Chosen: "TaskService.completeTask 훅 추가"
       Rationale: "중앙화된 로직, 누락 방지"

  DevBot-Senior (Reviewer):
    1. PR 자동 감지
    2. Code Review 실행:
       - ESLint, TypeScript 체크
       - 테스트 커버리지 >80%
       - 패턴 일관성
    3. 피드백:
       ✅ "Good: DocumentService 패턴 잘 활용"
       ⚠️ "Change: async 에러 핸들링 추가 필요"
    4. DevBot-AI에게 알림

  DevBot-AI:
    1. 피드백 반영
    2. 재제출
    3. ✅ Approved → 자동 머지 (CI 통과 시)
    4. Task 상태 → COMPLETED

17:00 - PriorityRebalancerService 실행
  ✅ 진행도 분석
  ✅ 블로커 Task escalation
  ✅ 내일 우선순위 조정

  예시:
    Task 6 (OpenAI embedding API 연동):
      - 예상: 2일
      - 실제: 3일 (API 키 문제)
      - 조정: P3 → P2
      - 액션: DevBot-Senior 협업 요청
```

**주간 루틴 (자동)**

```
월요일 10:00 - SprintPlanningService
  ✅ 지난 스프린트 회고:
     - 완료: 9/10 tasks (90%)
     - 미완료: Task 9 (이월)
     - 평균 소요 시간: 예상 대비 110%
     - 블로커: 1건 (해결됨)

  ✅ 이번 스프린트 목표:
     - Week 2 완료
     - 목표: Vector Search + Knowledge Graph
     - Task 선택: 8개 (이월 1 + 신규 7)

  ✅ Task 할당 조정:
     - DevBot-AI 과부하 → Task 1개 DevBot-Backend 재할당
     - DevBot-QA 여유 → 테스트 Task 추가

금요일 16:00 - RetrospectiveService
  ✅ 성과 분석:
     - Velocity: 9 tasks/week (안정적)
     - Code quality: A (테스트 커버리지 94%)
     - Collaboration: 2 sessions (효과적)

  ✅ 문제점:
     - OpenAI API 호출 비용 예상보다 높음
     - Vector search 성능 최적화 필요

  ✅ 개선 항목:
     - Embedding 캐싱 도입 (Task 자동 생성)
     - pgvector ivfflat 인덱스 튜닝

  ✅ Document 자동 생성:
     Title: "Week 1-2 Sprint Retrospective"
     Type: "meeting"
     Content: 회고록
     Action Items: 2개 Task 생성 (캐싱, 인덱스 튜닝)
```

**협업 시나리오**

```
Scenario 1: Vector Search 성능 문제
  DevBot-AI: "1000개 문서 대상 similarity search 너무 느림 (3초)"

  Step 1: CollaborationService 자동 실행
    ✅ 협업 요청 생성
       Type: pair_programming
       Reason: "Vector search performance bottleneck"

  Step 2: 협력자 찾기
    Selected: DevBot-Data (skills: postgres, performance)

  Step 3: 협업 세션
    ✅ 전용 채널: "#collab-vector-perf"
    ✅ 문제 분석: ivfflat 인덱스 lists 파라미터 부족
    ✅ 해결: lists = 100 → 500
    ✅ 성능: 3초 → 0.3초 (10배 개선)

  Step 4: 지식 문서화
    ✅ Document 생성:
       Title: "pgvector ivfflat Index Tuning"
       Type: "guide"
       Keywords: ["pgvector", "performance", "ivfflat"]
       Content: 문제, 해결책, 튜닝 가이드

Scenario 2: 아키텍처 결정 (인간 개입 필요) ⚠️
  DevBot-AI: "Embedding 모델 선택: text-embedding-3-small vs -large?"

  Step 1: UncertaintyDecisionService
    ✅ 불확실성 감지: "기술 선택 (ROI 불명확)"
    ✅ Spike 생성 결정

  Step 2: Spike Task 자동 생성
    Spike 1: "text-embedding-3-small POC"
       - Hollon: DevBot-AI
       - 타임박스: 1일
       - 평가: 정확도, 속도, 비용

    Spike 2: "text-embedding-3-large POC"
       - Hollon: DevBot-Backend
       - 타임박스: 1일
       - 평가: 정확도, 속도, 비용

  Step 3: POC 실행 (1일)
    Comparison:
      small: 정확도 82%, 속도 100ms, 비용 $0.02/1M tokens
      large: 정확도 89%, 속도 150ms, 비용 $0.13/1M tokens

    신뢰도: 70% (중간)

  Step 4: 인간 Escalation
    ApprovalRequest:
      Title: "Embedding 모델 선택"
      Options: ["small (비용효율)", "large (정확도)"]
      Recommendation: "small (7% 정확도 차이, 6.5배 비용 차이)"
      Confidence: 70%

  Step 5: 인간 결정 (30분)
    인간: "small로 시작, 정확도 문제 발생 시 large 재평가"
    ✅ Task 재개 (small 모델)
```

**인간 개입 (주 6-8시간)**

```
일일 체크 (매일 10분):
  09:10 - Standup 요약 확인
    ✅ 블로커 체크
    ✅ 진행도 확인
    ✅ Escalation 즉시 응답

주간 체크 (금요일 30분):
  16:30 - Retrospective 확인
    ✅ Velocity 적절한지
    ✅ 코드 품질 spot check
    ✅ 다음 스프린트 계획 검토

선택적 코드 리뷰:
  - Critical path (VectorSearch, PromptOptimizer)
  - 홀론이 이미 상호 리뷰 완료
```

---

#### Week 3-4: 자기 개선 시스템 구현 (홀론 주도)

**동일한 일일/주간 루틴 적용**

**핵심 Task 예시**:

```
Task 21: PerformanceAnalyzer
  DevBot-Backend:
    1. Task Pull (P1, assigned)
    2. 기존 holon_performance_summary 테이블 확인
    3. 코드 작성:
       - analyzeTaskCompletion(hollonId, taskId)
       - calculateMetrics (속도, 품질, 협업)
       - updatePerformanceSummary
    4. 테스트 작성 (20+ cases)
    5. PR 생성 → Review → Merge

Task 25: PromptOptimizer (복잡도 HIGH)
  DevBot-AI:
    1. Task Pull (P2, assigned)
    2. 문제 분석:
       - "어떤 프롬프트가 효과적이었나?"
       - "토큰 사용량 vs 품질 trade-off?"
    3. 설계:
       - Task metadata에 prompt template ID 추가
       - Cost/Quality 메트릭 수집
       - A/B 테스트 프레임워크
    4. 코드 작성 (복잡):
       - analyzePromptEffectiveness
       - comparePromptVariants
       - suggestOptimizations
    5. 블로커 발생:
       "통계적 유의성 판단 알고리즘 모름"
    6. 협업 요청 → DevBot-Senior
    7. 해결: t-test 또는 Mann-Whitney U test
    8. PR 생성 → Review (여러 라운드) → Merge

Task 28: BestPracticeService
  DevBot-AI:
    1. Task Pull (P2, assigned)
    2. 코드 작성:
       - extractPatternsFromHighPerformance
       - 고성과 Task (상위 20%) 분석
       - 공통 패턴 추출 (코드 구조, 의존성, 테스트 패턴)
    3. Document 자동 생성:
       Type: "memory"
       Title: "High Performance Task Patterns"
       Keywords: ["best-practice", "patterns", "high-performance"]
    4. 테스트 작성
    5. PR → Merge
```

---

#### Week 5: 완료 및 리뷰 (인간 주도, 2-3일)

**인간 검증**

```
Day 1: 테스트 실행
  ✅ 전체 테스트:
     - Unit: 564 + 120 = 684 tests
     - Integration: 105 tests
     - E2E: 158 + 20 = 178 tests
     Total: 967 tests ✅

  ✅ TypeScript: 0 errors ✅
  ✅ Build: Success ✅
  ✅ Lint: 0 errors ✅

Day 2: Phase 4 완료 기준 검증
  ✅ "Task 완료 후 Document 자동 생성":
     - KnowledgeExtractionService 작동
     - 실제 Task 완료 → Document 생성 확인
     - 결과: 100% 작동 ✅

  ✅ "Vector similarity search 작동":
     - VectorSearchService E2E 테스트
     - 정확도 측정: 87% (목표 85% 초과) ✅

  ✅ "효율성 20% 향상":
     - PerformanceAnalyzer 메트릭 확인
     - 동일 Task 5회 수행 비교
     - 결과: 24% 향상 (목표 초과) ✅

  ✅ "토큰 15% 절감":
     - PromptOptimizer 메트릭 확인
     - 최적화 전후 비교
     - 결과: 17% 절감 (목표 초과) ✅

Day 3: 최종 리뷰 및 승인
  ✅ Critical services 리뷰:
     - VectorSearchService
     - PromptOptimizer
     - KnowledgeGraphService

  ✅ 아키텍처 일관성 체크
  ✅ 성능 병목 체크
  ✅ Phase 4 완료 승인 🎉
```

**PR 병합**

```bash
# 홀론이 준비한 PR
PR: "feat: Phase 4 지식 시스템 및 자기 개선"
Files changed: 60+
Additions: 10,000+
Deletions: 300+

Modules:
  ✅ KnowledgeModule (Extraction, VectorSearch, Graph)
  ✅ PerformanceModule (Analyzer, Optimizer, BestPractice)

Tests:
  ✅ 140+ new tests
  ✅ 95%+ coverage

Documentation:
  ✅ API docs
  ✅ Architecture diagrams

Reviews:
  ✅ DevBot-Senior: Approved
  ✅ DevBot-QA: Approved
  ✅ Human: Approved

# 병합
git checkout HL-6
git pull origin HL-6
git checkout main
git merge HL-6 --no-ff
git push origin main
```

---

## 📊 성공 지표

### Phase 4 완료 기준 (필수)

| 기준                   | 측정 방법              | 목표 | 달성 예상 |
| ---------------------- | ---------------------- | ---- | --------- |
| **Document 자동 생성** | E2E 테스트             | 100% | 100% ✅   |
| **Vector search**      | 정확도 측정            | 85%+ | 87% ✅    |
| **효율성 향상**        | PerformanceAnalyzer    | 20%+ | 24% ✅    |
| **토큰 절감**          | PromptOptimizer 메트릭 | 15%+ | 17% ✅    |
| **코드 품질**          | 테스트 커버리지        | 90%+ | 95% ✅    |
| **테스트 통과**        | CI 결과                | 100% | 100% ✅   |

### 자율성 지표

| 지표                 | Phase 3.5 | Phase 4 목표  | 예상 달성     |
| -------------------- | --------- | ------------- | ------------- |
| **Task 자율 완료율** | 75%       | 80%+          | 85% ✅        |
| **인간 개입 시간**   | 주 10시간 | 주 8시간 이하 | 주 6-8시간 ✅ |
| **자동 Task 분해**   | 95%       | 95%+          | 95% ✅        |
| **자동 할당**        | 90%       | 90%+          | 90% ✅        |
| **협업 성공률**      | 80%       | 85%+          | 85% ✅        |

### 품질 지표

| 지표                | 목표 | 예상    |
| ------------------- | ---- | ------- |
| **TypeScript 에러** | 0    | 0 ✅    |
| **빌드 성공**       | 100% | 100% ✅ |
| **테스트 커버리지** | 90%+ | 95% ✅  |
| **문서화 완성도**   | 85%+ | 90% ✅  |

---

## 🚧 예상 리스크 및 완화 방안

### 리스크 1: Vector Search 성능 문제 (중간 확률)

**증상**:

```
1000개 문서 대상 similarity search 너무 느림
```

**완화**:

```
자동 감지:
  ✅ PerformanceMonitor가 slow query 감지
  ✅ 2초 이상 걸리면 경고

자동 대응:
  ✅ ivfflat index 파라미터 튜닝 Task 생성
  ✅ Embedding 캐싱 Task 생성

인간 개입:
  ⚠️ 튜닝 후에도 느리면 알림
  ⚠️ 아키텍처 재검토 (Embedding 모델 변경 등)
```

### 리스크 2: OpenAI API 비용 초과 (낮은 확률)

**증상**:

```
Embedding 생성 비용이 예상보다 3배 높음
```

**완화**:

```
조기 감지:
  ✅ CostCalculatorService 일일 체크
  ✅ 80% 도달 시 자동 경고

자동 조정:
  ✅ Embedding 캐싱 우선순위 상승
  ✅ 중복 Document 생성 방지 로직 강화

인간 결정:
  ⚠️ ApprovalRequest: "예산 증액 vs 기능 축소"
```

### 리스크 3: PromptOptimizer 복잡도 과소평가 (중간 확률)

**증상**:

```
DevBot-AI가 PromptOptimizer 3일째 진행 없음
"통계적 유의성 판단 알고리즘 모름"
```

**완화**:

```
자동 감지:
  ✅ PriorityRebalancer가 매일 진행도 체크
  ✅ 2일 이상 진행 없으면 escalation

자동 대응:
  ✅ CollaborationService → DevBot-Senior 할당
  ✅ 협업 세션 시작

인간 개입:
  ⚠️ 3일 후에도 해결 안 되면 인간 개입
  ⚠️ 알고리즘 직접 제시 또는 Task 단순화
```

---

## 📈 학습 및 개선

### Phase 4 진행 중 자동 학습

**KnowledgeExtractionService 자동 실행**:

```
모든 Task 완료 시:
  ✅ DecisionLog → memory document
  ✅ 코드 패턴 → best-practice document
  ✅ 협업 결과 → discussion document

→ Phase 5에서 자동 참조 ✅
```

**PerformanceAnalyzer 자동 실행**:

```
주간 분석:
  ✅ 각 Hollon 성과 측정
  ✅ 강점/약점 파악
  ✅ 할당 최적화 제안

→ Phase 5 할당 정확도 향상 ✅
```

**PromptOptimizer 자동 실행**:

```
Task 완료 시:
  ✅ 프롬프트 효과 분석
  ✅ 토큰 사용량 vs 품질
  ✅ 최적화 제안

→ Phase 5에서 토큰 25% 절감 예상 ✅
```

### Phase 4 완료 후 회고

**전체 회고**:

```
1. 무엇이 잘 됐는가?
   - Vector search 정확도 목표 초과 (87%)
   - 홀론 협업 원활 (85% 성공률)
   - Document 자동 생성 100% 작동

2. 무엇이 어려웠는가?
   - PromptOptimizer 통계 알고리즘 (복잡)
   - OpenAI API 비용 관리
   - Vector index 튜닝

3. 무엇을 배웠는가?
   - pgvector ivfflat index 최적화
   - Embedding 모델 선택 기준
   - 성과 분석 메트릭 설계

4. 다음 Phase 5는?
   - ✅ 지식 시스템 준비 완료
   - ✅ 자기 개선 메커니즘 작동
   - ✅ Phase 5 시작 가능!
```

**Document 자동 생성**:

```
Title: "Phase 4 Dogfooding 회고록"
Type: "postmortem"
Scope: "organization"
Keywords: ["phase4", "knowledge-system", "self-improvement", "retrospective"]

Content:
  - Executive Summary
  - 목표 및 달성률 (100%)
  - 핵심 통찰 (AI는 Memory로 학습)
  - 학습 내용 (Vector RAG, 성과 분석)
  - Phase 5 준비 상태
```

---

## 🎉 성공 시나리오

### 낙관적 시나리오 (50% 확률)

```
Week 0: 킥오프 (1일)
  ✅ Goal 생성 → 30개 Task 자동 생성
  ✅ 5명 Hollon 팀 구성
  ✅ Sprint 1 시작

Week 1-2: Knowledge 시스템 (순조)
  ✅ KnowledgeExtraction: 완료 (90% 자율)
  ✅ VectorSearch: 완료 (85% 자율, Spike 1회)
  ✅ KnowledgeGraph: 완료 (80% 자율)
  ✅ Sprint 1 목표: 18/19 tasks 완료

Week 3-4: 자기 개선 (순조)
  ✅ PerformanceAnalyzer: 완료 (90% 자율)
  ✅ PromptOptimizer: 완료 (75% 자율, 협업 1회)
  ✅ BestPractice: 완료 (85% 자율)
  ✅ Sprint 2 목표: 11/11 tasks 완료

Week 5: 완료 (2일)
  ✅ 전체 테스트 967 passing
  ✅ 인간 최종 리뷰
  ✅ main 병합
  ✅ Phase 4 완료! 🎉

결과:
- 소요 시간: 4주 (목표 달성)
- 자율성: 85% (목표 80% 초과)
- 인간 개입: 주 6시간 (목표 달성)
- 코드 품질: A급
- 성공 기준: 모두 달성 ✅
```

### 현실적 시나리오 (40% 확률)

```
Week 0: 킥오프
  ✅ 순조로운 시작

Week 1-2: Knowledge 시스템
  ✅ KnowledgeExtraction: 성공
  ⚠️ VectorSearch: Spike 2회 (모델 선택, 성능)
  ⚠️ 인간 개입: 아키텍처 결정 (2시간)
  ✅ Sprint 1: 17/19 tasks

Week 3-4: 자기 개선
  ⚠️ PromptOptimizer: 복잡, 협업 2회
  ✅ PerformanceAnalyzer: 성공
  ✅ Sprint 2: 10/11 tasks

Week 5: 완료 및 마무리
  ✅ 이월 Task 완료
  ✅ 통합 테스트
  ✅ Phase 4 완료

결과:
- 소요 시간: 5주 (목표 +1주)
- 자율성: 80% (목표 달성)
- 인간 개입: 주 8시간 (목표 달성)
- 코드 품질: A급
- 성공 기준: 모두 달성 ✅
```

---

## 🎯 최종 체크리스트

### Phase 3.5 완료 확인 (필수)

- [x] 자율 코드 리뷰 (CodeReviewerService)
- [x] PR 자동 병합 (AutoMergeService)
- [x] 목표 분해 통합 (GoalDecompositionService)
- [x] Message 기반 자동화 (MessageListener)
- [x] Document/DocumentService 구현
- [x] PromptComposerService Layer 5

### Phase 4 킥오프 전 (필수)

- [ ] Phase 4 OKR 정의
- [ ] 성공 기준 명확화
- [ ] 예산 설정
- [ ] Escalation 프로토콜 확립

### Phase 4 진행 중 (주간 체크)

- [ ] Standup 일일 확인
- [ ] Retrospective 주간 확인
- [ ] 예산 사용률 체크
- [ ] Escalation 즉시 응답

### Phase 4 완료 시 (최종 검증)

- [ ] 모든 테스트 통과 (967+ tests)
- [ ] TypeScript 0 errors
- [ ] Build success
- [ ] Document 자동 생성 100%
- [ ] Vector search 정확도 85%+
- [ ] 효율성 20% 향상
- [ ] 토큰 15% 절감
- [ ] 인간 최종 리뷰 통과
- [ ] main 브랜치 병합

---

## 📚 Blueprint Phase 4와의 일치성 검토

### Blueprint.md Week 19-24 vs 수정된 Phase 4

**❌ 제거한 것 (Week 19-20)**:

```
OnboardingService  → AI는 온보딩 불필요
SkillMatrixService → 스킬은 Role에 정의됨
```

**✅ 유지한 것 (Week 21-22, 23-24)**:

```
Week 21-22 (Knowledge 관리):
  ✅ KnowledgeExtractionService → 구현 (Week 1-2)
  ✅ KnowledgeGraphService → 구현 (Week 1-2)
  ✅ ExternalKnowledgeService → 선택적 (필요 시 추가)
  ✅ BestPracticeService → 구현 (Week 3-4)

Week 23-24 (자기 개선):
  ✅ PerformanceAnalyzer → 구현 (Week 3-4)
  ✅ PromptOptimizer → 구현 (Week 3-4)
  ✅ ProcessImprovementService → BestPractice에 통합
```

**➕ 추가한 것**:

```
VectorSearchService → Blueprint 암시하지만 명시 없음
  - pgvector embedding 필드 활용
  - OpenAI embedding API 연동
  - PromptComposerService 통합 (Layer 5 개선)
```

### 결론

**일치도: 85%**

- ✅ 핵심 목표 일치: "학습 및 성장"
- ✅ Week 21-24 서비스 대부분 구현
- ❌ Week 19-20 제거 (철학적 이유로 정당화됨)
- ➕ Vector RAG 추가 (인프라가 이미 준비됨)
- 📦 4주로 압축 (온보딩 제거로 2주 절약)

**Blueprint 업데이트 권장사항**:

```diff
### Phase 4: 학습 및 성장 - 6주
+ ### Phase 4: 학습 및 성장 - 4주

핵심 목표: **홀론과 조직이 경험에서 학습하여 지속 개선**

- Week 19-20: 온보딩 시스템
- ├── OnboardingService
- └── SkillMatrixService

+ Week 19-20 (1-2): 지식 추출 및 Vector RAG
+ ├── KnowledgeExtractionService
+ ├── VectorSearchService (pgvector 활용)
+ └── KnowledgeGraphService

Week 21-22: 지식 관리 고도화
- ├── KnowledgeExtractionService
- ├── KnowledgeGraphService
├── ExternalKnowledgeService (선택)
└── BestPracticeService

+ Week 21-22 (3-4): 자기 개선 시스템
- Week 23-24: 자기 개선 시스템
├── PerformanceAnalyzer
├── PromptOptimizer
- └── ProcessImprovementService
+ └── BestPracticeService
```

---

## ✅ 성공 기준 및 검증

### Phase 4 완료 기준 (필수)

| 기준                    | 측정 방법              | 목표 | 검증 명령어                                            |
| ----------------------- | ---------------------- | ---- | ------------------------------------------------------ |
| **Document 자동 생성**  | E2E 테스트             | 100% | `pnpm test:e2e knowledge-extraction`                   |
| **Vector search**       | 정확도 측정            | 85%+ | `pnpm test:e2e vector-search-accuracy`                 |
| **효율성 향상**         | PerformanceAnalyzer    | 20%+ | `curl /performance/metrics?hollonId=...`               |
| **토큰 절감**           | PromptOptimizer 메트릭 | 15%+ | `curl /prompt-optimizer/token-savings`                 |
| **코드 품질**           | 테스트 커버리지        | 90%+ | `pnpm test:coverage`                                   |
| **테스트 통과**         | CI 결과                | 100% | `pnpm test:all`                                        |
| **Manager 분배 정확도** | 스킬 매칭 성공률       | 80%+ | `curl /tasks?projectId=...` (assignedHollon 스킬 확인) |

### 자율성 지표

| 지표                  | Phase 3.7 | Phase 4 목표 | 검증 방법                                    |
| --------------------- | --------- | ------------ | -------------------------------------------- |
| **Task 자율 완료율**  | 100%      | 100%         | `(completed / total) * 100`                  |
| **인간 개입 빈도**    | Goal 1회  | Goal 1회     | ApprovalRequest 생성 횟수 (주 2회 이하)      |
| **Manager 분배 성공** | N/A       | 95%+         | (성공 분배 / 전체 Team Task) \* 100          |
| **자동 Task pull**    | 100%      | 100%         | Hollon이 스스로 다음 Task 선택 (인간 개입 0) |
| **협업 성공률**       | 85%       | 85%+         | CollaborationService 성공률                  |

### 품질 지표

```bash
# 1. 전체 테스트 실행
pnpm --filter @hollon-ai/server test:all

# 예상 결과:
# Unit tests: 684+ passing
# Integration tests: 120+ passing
# E2E tests: 180+ passing
# Total: 984+ tests

# 2. TypeScript 컴파일
pnpm --filter @hollon-ai/server build

# 예상: 0 errors

# 3. Lint 체크
pnpm --filter @hollon-ai/server lint

# 예상: 0 errors, 0 warnings

# 4. Coverage 확인
pnpm --filter @hollon-ai/server test:coverage

# 예상:
# Statements   : 90%+
# Branches     : 85%+
# Functions    : 90%+
# Lines        : 90%+
```

### Phase 4 킥오프 전 체크리스트

```bash
# 1. Phase 3.8 완료 확인
pnpm --filter @hollon-ai/server test:integration

# 필수 통과 테스트:
# ✅ phase3.8-team-distribution.integration-spec.ts
# ✅ phase3.7-autonomous-execution.integration-spec.ts
# ✅ phase3.7-infinite-loop-prevention.integration-spec.ts

# 2. Manager Hollon 확인
curl -s http://localhost:3001/organizations | jq '.[0].id' | \
  xargs -I {} curl -s "http://localhost:3001/teams?organizationId={}" | \
  jq '.[] | select(.name == "Phase 4 Knowledge Team") | {name, managerHollonId}'

# 예상: managerHollonId가 존재해야 함

# 3. Document 인프라 확인
psql -U hollon_dev -d hollon_dev -c "\d hollon.documents" | grep embedding

# 예상: embedding | vector(1536) 확인

# 4. GitHub CLI 인증
gh auth status

# 예상: "Logged in to github.com"
```

### Phase 4 진행 중 체크리스트 (주간)

**일일 체크 (매일 오전 9:10, 10분):**

- [ ] Standup 요약 확인 (`curl /channels/standup/messages | tail`)
- [ ] 블로커 Task 확인 (`curl /tasks?status=blocked&projectId=...`)
- [ ] Escalation 즉시 응답 (`curl /approval-requests?status=pending`)

**주간 체크 (금요일 오후 4:30, 30분):**

- [ ] Retrospective 확인 (`curl /documents?type=meeting&tag=retrospective`)
- [ ] Velocity 적절한지 (주 9-11 tasks 완료)
- [ ] 코드 품질 spot check (PR 2-3개 리뷰)
- [ ] 다음 Sprint 계획 검토

### Phase 4 완료 시 최종 검증

```bash
# 1. 모든 테스트 통과 확인
pnpm --filter @hollon-ai/server test:all
# 예상: 984+ tests passing

# 2. TypeScript 빌드
pnpm --filter @hollon-ai/server build
# 예상: Build successful

# 3. Document 자동 생성 검증
curl -s "http://localhost:3001/documents?type=knowledge&autoGenerated=true" | \
  jq 'length'
# 예상: 30+ (Task당 1개 이상)

# 4. Vector search 정확도 검증
pnpm --filter @hollon-ai/server test:e2e vector-search-accuracy
# 예상: Accuracy >= 85%

# 5. 효율성 향상 검증
curl -s "http://localhost:3001/performance/hollons" | \
  jq '.[] | {name, efficiencyImprovement}'
# 예상: 20%+ improvement

# 6. 토큰 절감 검증
curl -s "http://localhost:3001/prompt-optimizer/savings" | \
  jq '.tokenSavingsPercent'
# 예상: >= 15%

# 7. Manager 분배 정확도 검증
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID&depth=1" | \
  jq 'map(select(.assignedHollon != null)) |
      map({
        task: .title,
        hollon: .assignedHollon.name,
        hollonSkills: .assignedHollon.role.capabilities,
        taskRequiredSkills: .requiredSkills
      })' | \
  # 수동 검증: assignedHollon의 스킬이 taskRequiredSkills와 80% 이상 매칭
```

### 검증 체크리스트 요약

**Phase 4 킥오프 전 (필수):**

- [ ] Phase 3.8 integration tests 통과
- [ ] Manager Hollon 생성 확인
- [ ] Document + pgvector 인프라 확인
- [ ] GitHub CLI 인증 완료

**Phase 4 진행 중 (주간):**

- [ ] 일일 Standup 확인 (10분)
- [ ] 블로커 즉시 해결 (필요 시)
- [ ] 주간 Retrospective 리뷰 (30분)
- [ ] 선택적 코드 리뷰 (critical path만)

**Phase 4 완료 시 (최종):**

- [ ] 모든 테스트 통과 (984+ tests)
- [ ] TypeScript 0 errors
- [ ] Build success
- [ ] Document 자동 생성 100%
- [ ] Vector search 정확도 85%+
- [ ] 효율성 20% 향상
- [ ] 토큰 15% 절감
- [ ] Manager 분배 정확도 80%+
- [ ] 인간 최종 리뷰 통과
- [ ] main 브랜치 병합

---

## 📚 SSOT 준수 확인

### ✅ 구현된 내용이 SSOT 원칙을 준수하는지 검증

#### 1. Task Hierarchy & XOR Constraints ✅

- **SSOT 원칙**: Task는 재귀적 구조, Project 없이도 생성 가능
- **Phase 3.8 구현**: Team Task (depth=0) → Hollon Task (depth=1)
- **검증**: XOR 제약 (assignedHollon OR assignedTeam)

#### 2. Single Context 원칙 ✅

- **SSOT 원칙**: 하나의 컨텍스트에서 하나의 Task 완료
- **Phase 3.7 구현**: HollonOrchestrator.runCycle()

#### 3. 동시성 모델 (Concurrency) ✅

- **SSOT 원칙**: 병렬성이 아닌 동시성 (DB 기반)
- **Phase 3.7 구현**: HollonExecutionService Cron Jobs

#### 4. 6계층 프롬프트 합성 ✅

- **SSOT 원칙**: Organization → Team → Role → Hollon → Memory → Task
- **구현**: PromptComposerService (Layer 1-6)

#### 5. 에스컬레이션 계층 (Level 1-5) ✅

- **SSOT 원칙**: 자기 해결 → 팀 협업 → 팀 리더 → 상위 조직 → 인간
- **Phase 3.8 구현**: Manager 역할, EscalationService

#### 6. 임시 Hollon (Sub-Hollon) ✅

- **SSOT 원칙**: 영구 홀론이 필요 시 임시 홀론 생성/종료
- **Phase 3.7 구현**: HollonLifecycle.TEMPORARY, depth=1 제약

#### 7. 안전장치 ✅

- **SSOT 6.7**: 재귀 제한, 파일 충돌 방지, 롤백 전략
- **Phase 3.7 구현**: Exponential backoff, Stuck Task 감지, Emergency Stop

### 결론: SSOT 100% 준수 ✅

---

**문서 버전**: 3.0
**최종 업데이트**: 2025-12-10
**작성자**: Claude Code
**상태**: Phase 4 실행 가이드 완성 (phase4-execution-guide.md 통합 완료)

---

## 📝 변경 이력

| 날짜       | 버전 | 변경 내용                                                   |
| ---------- | ---- | ----------------------------------------------------------- |
| 2025-12-10 | 1.0  | 초기 Phase 4 Dogfooding 계획 작성                           |
| 2025-12-10 | 2.0  | Phase 3.7 (완전 자율 실행) 반영                             |
| 2025-12-10 | 3.0  | phase4-execution-guide.md 통합, 3단계 빠른 실행 가이드 추가 |
|            |      | API 호출 가이드 명확화, Manager 기반 분배 설명 추가         |
|            |      | 모니터링/트러블슈팅 섹션 통합, SSOT 준수 검증 추가          |
