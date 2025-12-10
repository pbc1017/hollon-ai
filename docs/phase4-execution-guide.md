# 🎮 Phase 4 실행 가이드 (Execution Playbook)

> **작성일**: 2025-12-10
> **최종 수정**: 2025-12-10
> **핵심 변경 (Phase 3.8)**: Team-based Distribution with Manager Hollons

---

## 🎯 Quick Summary

**3단계로 Phase 4 시작 (Phase 3.8 방식):**

1. **DB Seed 실행** (Manager + Phase 4 Team 자동 생성)
2. **Goal 생성 + useTeamDistribution: true** → Team Task 생성
3. **Manager 자동 분배** → TeamTaskDistributionService가 Brain Provider로 할당 결정

---

## ✅ 사전 준비 체크리스트

```bash
# 1. Phase 3.5 완료 확인
cd /Users/perry/Documents/Development/hollon-ai
git status

# 2. 통합 테스트 실행
pnpm --filter @hollon-ai/server test:integration

# 3. DB 상태 확인
psql -U hollon -d hollon -c "\dt hollon.*" | grep documents
```

**필수 조건:**

- [x] Phase 3.8 TeamTaskDistributionService 구현 완료
- [x] Phase 3.8 ManagerService 구현 완료
- [x] Phase 3.7 HollonExecutionService 구현 완료 (자동 실행)
- [x] Phase 3.5 TaskExecutionService 구현 완료 (Worktree/PR)
- [x] MessageListener 동작 확인
- [x] GitHub CLI (`gh`) 설치 및 인증 완료

---

## 📝 실행 절차

### **Step 1: DB Seed (2분)**

> **Phase 3.8 변경사항**: Seed가 이제 Manager Hollon과 Phase 4 Team을 자동 생성합니다

```bash
pnpm --filter @hollon-ai/server db:seed

# 결과:
# ✅ 3 Teams (Core Development, Dogfooding Team, Phase 4 Knowledge Team)
# ✅ 6 Roles (Backend, Frontend, QA, Manager, AIEngineer, DataEngineer)
# ✅ 10 Hollons including:
#    - Manager-Dogfood (Dogfooding Team)
#    - Manager-Knowledge (Phase 4 Team)
#    - DevBot-AI, DevBot-Data, DevBot-Backend, ReviewBot-QA (Phase 4 members)
```

### **Step 2: 서버 시작**

```bash
pnpm --filter @hollon-ai/server dev

# 확인
curl http://localhost:3001/health
```

### **Step 3: Phase 4 Goal 생성 (2분)**

> **Phase 3.8 변경사항**: Hollon을 수동으로 생성할 필요 없음 (Seed에서 자동 생성됨)

```bash
# Organization ID
ORG_ID=$(curl -s http://localhost:3001/organizations | jq -r '.[0].id')

# Phase 4 Team ID (이미 Seed에서 생성됨)
PHASE4_TEAM_ID=$(curl -s "http://localhost:3001/teams?organizationId=$ORG_ID" | \
  jq -r '.[] | select(.name == "Phase 4 Knowledge Team") | .id')

echo "✅ Phase 4 Team ID: $PHASE4_TEAM_ID"

# Phase 4 Manager 확인
MANAGER_ID=$(curl -s "http://localhost:3001/teams/$PHASE4_TEAM_ID" | \
  jq -r '.managerHollonId')

echo "✅ Manager-Knowledge ID: $MANAGER_ID"
```

### **Step 4: Goal 생성 (2분)**

```bash
GOAL=$(curl -s -X POST http://localhost:3001/goals \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "'$ORG_ID'",
    "title": "Phase 4: 지식 시스템 및 자기 개선",
    "description": "홀론이 경험에서 학습하고 프롬프트를 최적화",
    "goalType": "project",
    "priority": "high",
    "targetDate": "2025-01-10"
  }')
GOAL_ID=$(echo $GOAL | jq -r '.id')
echo "✅ Goal: $GOAL_ID"
```

### **Step 5: Decomposition + Team Distribution (2-3분)**

> **Phase 3.8 핵심 변경**: `useTeamDistribution: true` → Goal이 Team Task로 분해됨

```bash
curl -X POST "http://localhost:3001/goals/$GOAL_ID/decompose" \
  -H "Content-Type: application/json" \
  -d '{
    "maxTasks": 30,
    "preferredComplexity": "medium",
    "useTeamDistribution": true
  }' | jq .

# Project ID
PROJECT_ID=$(curl -s http://localhost:3001/projects | \
  jq -r '.[] | select(.name | contains("Phase 4")) | .id')

# Team Task 확인 (Level 0)
echo "\n📋 Team Tasks (Level 0):"
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID&type=team_epic" | \
  jq '.[] | {title, assignedTeam: .assignedTeam.name, status}'
```

**Phase 3.8 자동 분배 흐름:**

1. **GoalDecompositionService** (`useTeamDistribution: true`)
   - Goal을 3-7개의 Team Task (TEAM_EPIC)로 분해
   - 각 Team Task를 Phase 4 Knowledge Team에 할당
   - Status: PENDING

2. **HollonExecutionService** (매 30초)
   - PENDING Team Task 자동 감지
   - TeamTaskDistributionService.distributeToTeam() 호출

3. **TeamTaskDistributionService** (Manager AI 결정)
   - Manager-Knowledge가 Brain Provider 호출
   - 팀원 정보 분석 (DevBot-AI, DevBot-Data, DevBot-Backend, ReviewBot-QA)
   - 각 팀원의 스킬, 현재 워크로드 고려
   - 3-7개 Hollon Task (Level 1) 생성 및 할당
   - Team Task status → IN_PROGRESS

4. **HollonExecutionService** (매 10초)
   - READY Hollon Task 감지
   - 각 Hollon이 자율 실행 시작

### **Step 6: 분배 결과 확인 (2분)**

```bash
# 30초 대기 (HollonExecutionService가 Team Task 분배 실행)
echo "⏳ Waiting for TeamTaskDistributionService (30 seconds)..."
sleep 30

# Hollon Task 확인 (Level 1)
echo "\n📋 Hollon Tasks (Level 1):"
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID" | \
  jq '.[] | select(.depth == 1) | {title, assignedHollon: .assignedHollon.name, status}'

# Manager 분배 통계
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID" | \
  jq 'group_by(.assignedHollon.name) | map({hollon: .[0].assignedHollon.name, count: length})'
```

### **Step 7: Sprint 자동 시작 ✨ (Phase 3.7 완전 자율 실행)**

**HollonExecutionService + TaskExecutionService 자동 실행:**

Goal 분해 + Team Distribution 완료 후, **완전 자율 실행 시작!**

#### Phase 3.8 자동 실행 메커니즘:

**1️⃣ Team Task 자동 분배 (매 30초)**

- HollonExecutionService.distributeTeamTasks()
- PENDING Team Task 감지
- TeamTaskDistributionService → Manager Brain Provider 호출
- Manager가 팀원에게 Hollon Task 분배

**2️⃣ Hollon Task 자동 실행 (매 10초)**

- HollonExecutionService.executeAssignedHollons()
- IDLE + READY Task 있는 Hollon 감지
- HollonOrchestrator.runCycle() 자동 호출

**3️⃣ Task 실행 플로우 (완전 자동)**

```
Goal → Team Task (Level 0, PENDING)
↓ 30초 후 (distributeTeamTasks)
Manager Brain Provider → Hollon Task 생성 (Level 1, READY)
↓ 10초 후 (executeAssignedHollons)
HollonOrchestrator.runCycle()
↓
Git Worktree 생성 (feature/task-xxx)
↓
Brain Provider 실행 (코딩 + 커밋)
↓
git push origin feature/task-xxx
↓
gh pr create → PR 생성
↓
MessageListener (1분 후)
↓
CodeReviewService → 자동 리뷰
↓
AutoMergeService → 자동 병합
↓
Task 완료 → Hollon IDLE
↓ 10초 후
다음 Task 자동 시작 (반복)
```

#### 🎉 완전 자율 실행!

- ✅ **인간 개입 불필요**: Goal 생성 후 모니터링만 하면 됨
- ✅ **자동 Task Pull**: Hollon이 스스로 다음 Task 선택
- ✅ **자동 PR 생성**: gh CLI를 통한 PR 자동 생성
- ✅ **자동 Code Review**: MessageListener가 자동 리뷰 실행
- ✅ **자동 Merge**: 승인 시 자동 병합
- ✅ **무한 반복**: Task 완료 후 다음 Task 자동 시작

#### 안전장치 (Phase 3.7):

- ✅ **동시 실행 제한**: Organization.maxConcurrentHolons
- ✅ **무한 루프 방지**: Exponential backoff (5분 → 15분 → 1시간)
- ✅ **Emergency Stop**: POST /organizations/:id/emergency-stop
- ✅ **Stuck Task 감지**: 2시간 이상 IN_PROGRESS → 자동 복구
- ✅ **진행률 모니터링**: 30분마다 진행 상황 로그

#### Emergency Stop (긴급 중단):

```bash
# 자율 실행 중단
curl -X POST "http://localhost:3001/organizations/$ORG_ID/emergency-stop" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Testing Phase 4 setup"}'

# 실행 재개
curl -X POST "http://localhost:3001/organizations/$ORG_ID/resume-execution"
```

```bash
# 진행 상황 확인
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID&status=in_progress" | \
  jq '.[] | {title, hollon: .assignedHollon.name}'

# PR 목록
gh pr list --label "phase-4"
```

### **Step 8: 모니터링**

```bash
# Dashboard
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID" | \
  jq 'group_by(.status) | map({status: .[0].status, count: length})'

# Hollon 상태
curl -s "http://localhost:3001/hollons?organizationId=$ORG_ID" | \
  jq '.[] | {name, status, completed: (.tasksCompleted // 0)}'

# 블로커
curl -s "http://localhost:3001/tasks?status=blocked&projectId=$PROJECT_ID" | \
  jq '.[] | {title, reason: .blockedReason}'
```

---

## 🔧 트러블슈팅

### "Team Task가 분배되지 않음"

**원인**: Team에 Manager가 할당되지 않음

```bash
# Manager 확인
curl -s "http://localhost:3001/teams/$PHASE4_TEAM_ID" | jq '.managerHollonId'

# 해결: DB re-seed
pnpm --filter @hollon-ai/server db:seed
```

### "Manager가 분배 실패 (Brain Provider 에러)"

**원인**: Brain Provider response parsing 실패

```bash
# 로그 확인
tail -f logs/app.log | grep "TeamTaskDistributionService"

# 해결: Manager system prompt 검증, Brain Provider JSON 응답 확인
```

### "Hollon Task가 생성되지만 실행 안 됨"

**원인**: Task status가 READY가 아님 (PENDING 상태)

```bash
# Task status 확인
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID" | jq '.[] | {title, status}'

# 해결: Manager 분배 시 status를 READY로 설정하는지 확인
```

### "Worktree creation failed"

→ `git worktree list` 확인, `git worktree remove --force`

### "gh pr create failed"

→ `gh auth login` 실행, `gh auth status` 확인

---

## ✅ 검증 체크리스트

**Week 1-2:**

- [ ] Manager가 Team Task를 성공적으로 분배 (Level 0 → Level 1)
- [ ] KnowledgeExtractionService 구현 (DevBot-AI)
- [ ] VectorSearchService 구현 (DevBot-AI)
- [ ] KnowledgeGraphService 구현 (DevBot-Data)
- [ ] 단위 테스트 85%+ (ReviewBot-QA)
- [ ] Manager 분배 정확도 80%+ (적절한 스킬 매칭)

**Week 3-4:**

- [ ] PerformanceAnalyzer 구현 (DevBot-Backend)
- [ ] PromptOptimizer 구현 (DevBot-Backend)
- [ ] BestPracticeService 구현 (DevBot-Backend)
- [ ] Vector search 정확도 85%+
- [ ] Manager가 블로커 감지 및 재분배 성공

**최종 검증:**

```bash
pnpm --filter @hollon-ai/server test:all
curl -s "http://localhost:3001/documents?type=knowledge" | jq 'length'  # 30+
```

---

## 🎯 성공 기준

1. **기능 완성도**: 모든 서비스 구현, 테스트 85%+
2. **Phase 3.8 통합**: Manager 기반 자동 분배 100% 작동
   - Team Task → Hollon Task 자동 분배
   - Manager Brain Provider 결정 정확도 80%+
   - 블로커 감지 및 재분배 성공
3. **자율성 95%**: Goal 생성 후 완전 자동 실행
   - 자동 Team Task 분해
   - 자동 Manager 분배
   - 자동 Hollon 실행
   - 자동 PR 생성 및 Code Review
4. **품질 A급**: ESLint 0 에러, PR 리뷰 90+
5. **학습 효과**: Document 자동 생성 100%, 효율성 20% 향상
