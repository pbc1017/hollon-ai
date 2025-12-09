# 🎮 Phase 4 실행 가이드 (Execution Playbook)

> **작성일**: 2025-12-10  
> **최종 수정**: 2025-12-10  
> **핵심 변경**: Hollon 먼저 생성 → Goal Decomposition `autoAssign: true` 옵션으로 자동 할당

---

## 🎯 Quick Summary

**3단계로 Phase 4 시작:**

1. **Hollon 생성** (DevBot-AI, DevBot-Data) → Role.capabilities 정의
2. **Goal 생성 + autoAssign** → ResourcePlannerService가 자동 할당
3. **모니터링** → TaskExecutionService가 Worktree/PR 자동화

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

- [ ] Phase 3 ResourcePlannerService 구현 완료
- [ ] Phase 3.5 TaskExecutionService 구현 완료 (Worktree/PR)
- [ ] MessageListener 동작 확인
- [ ] GitHub CLI (`gh`) 설치 및 인증 완료

---

## 📝 실행 절차

### **Step 1: DB Seed (2분)**

```bash
pnpm --filter @hollon-ai/server db:seed

# 결과: Organization, Teams, Hollons (DevBot-1, DevBot-2, ReviewBot)
```

### **Step 2: 서버 시작**

```bash
pnpm --filter @hollon-ai/server dev

# 확인
curl http://localhost:3001/health
```

### **Step 3: Phase 4 Hollon 생성 (10분)**

> **중요**: Goal 생성 **전에** Hollon을 먼저 생성해야 autoAssign이 작동

```bash
# Organization ID
ORG_ID=$(curl -s http://localhost:3001/organizations | jq -r '.[0].id')

# AIEngineer Role
AI_ROLE=$(curl -s -X POST http://localhost:3001/roles \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "'$ORG_ID'",
    "name": "AIEngineer",
    "description": "NLP, Embedding, Vector 검색 전문가",
    "capabilities": ["nlp", "embedding", "vector", "openai-api", "pgvector"]
  }')
AI_ROLE_ID=$(echo $AI_ROLE | jq -r '.id')

# DataEngineer Role
DATA_ROLE=$(curl -s -X POST http://localhost:3001/roles \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "'$ORG_ID'",
    "name": "DataEngineer",
    "description": "Graph, Database 전문가",
    "capabilities": ["graph", "database", "postgresql", "data-modeling"]
  }')
DATA_ROLE_ID=$(echo $DATA_ROLE | jq -r '.id')

# Phase 4 Team
TEAM=$(curl -s -X POST http://localhost:3001/teams \
  -H "Content-Type: application/json" \
  -d '{"organizationId": "'$ORG_ID'", "name": "Phase 4 Knowledge Team"}')
TEAM_ID=$(echo $TEAM | jq -r '.id')

# DevBot-AI
DEVBOT_AI=$(curl -s -X POST http://localhost:3001/hollons \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DevBot-AI",
    "organizationId": "'$ORG_ID'",
    "teamId": "'$TEAM_ID'",
    "roleId": "'$AI_ROLE_ID'",
    "brainProviderId": "claude_code"
  }')
DEVBOT_AI_ID=$(echo $DEVBOT_AI | jq -r '.id')

# DevBot-Data
DEVBOT_DATA=$(curl -s -X POST http://localhost:3001/hollons \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DevBot-Data",
    "organizationId": "'$ORG_ID'",
    "teamId": "'$TEAM_ID'",
    "roleId": "'$DATA_ROLE_ID'",
    "brainProviderId": "claude_code"
  }')
DEVBOT_DATA_ID=$(echo $DEVBOT_DATA | jq -r '.id')

echo "✅ Hollon setup completed"
echo "   DevBot-AI: $DEVBOT_AI_ID (nlp, embedding, vector)"
echo "   DevBot-Data: $DEVBOT_DATA_ID (graph, database)"
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

### **Step 5: Decomposition + 자동 할당 (2-3분)**

> **핵심**: `autoAssign: true` → ResourcePlannerService가 자동 할당

```bash
curl -X POST "http://localhost:3001/goals/$GOAL_ID/decompose" \
  -H "Content-Type: application/json" \
  -d '{
    "maxTasks": 30,
    "preferredComplexity": "medium",
    "autoAssign": true
  }' | jq .

# Project ID
PROJECT_ID=$(curl -s http://localhost:3001/projects | \
  jq -r '.[] | select(.name | contains("Phase 4")) | .id')

# 할당 결과 확인
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID" | \
  jq 'group_by(.assignedHollon.name) | map({hollon: .[0].assignedHollon.name, count: length})'
```

**자동 할당 로직 (ResourcePlannerService):**

- **DevBot-AI** (capabilities: `["nlp", "embedding", "vector"]`)  
  → VectorSearch Task에 높은 점수 (50점 만점)
- **DevBot-Data** (capabilities: `["graph", "database"]`)  
  → KnowledgeGraph Task에 높은 점수
- **DevBot-1, DevBot-2** (capabilities: `["typescript", "nestjs"]`)  
  → Backend/Self-Improvement Task
- **ReviewBot** (capabilities: `["testing"]`)  
  → 테스트 Task

### **Step 6: 검증 및 조정 (5분)**

```bash
# 할당 통계
curl -s "http://localhost:3001/tasks?projectId=$PROJECT_ID" | jq '{
  total: length,
  assigned: [.[] | select(.assignedHollonId)] | length,
  avgMatchScore: ([.[] | .matchScore] | add / length)
}'

# Workload 밸런스
curl -s "http://localhost:3001/hollons?organizationId=$ORG_ID" | \
  jq 'map({name, tasks: (.currentTaskCount // 0)})'

# 재조정 (필요 시)
curl -X POST "http://localhost:3001/tasks/projects/$PROJECT_ID/rebalance"
```

### **Step 7: Sprint 시작 (자동)**

**MessageListener + TaskExecutionService 자동 실행:**

1. Task `ready` + `assignedHollonId` → MessageListener 알림
2. Hollon Pull → TaskExecutionService 실행:
   - Git Worktree 생성 (`feature/task-xxx`)
   - Brain Provider 실행 (코딩 + 커밋)
   - `git push origin feature/task-xxx`
   - `gh pr create`
   - CodeReviewService 자동 리뷰
   - AutoMergeService 자동 병합

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

### "autoAssign: true인데 할당 안됨"

→ Hollon을 Goal 생성 **전에** 만들어야 함

### "매칭 점수 낮음 (<40점)"

→ Task.requiredSkills와 Role.capabilities 불일치 확인

### "Worktree creation failed"

→ `git worktree list` 확인, `git worktree remove --force`

### "gh pr create failed"

→ `gh auth login` 실행, `gh auth status` 확인

---

## ✅ 검증 체크리스트

**Week 1-2:**

- [ ] KnowledgeExtractionService 구현 (Task 1-5)
- [ ] VectorSearchService 구현 (Task 6-9)
- [ ] KnowledgeGraphService 구현 (Task 10-13)
- [ ] 단위 테스트 85%+
- [ ] ResourcePlanner 평균 매칭 75+

**Week 3-4:**

- [ ] PerformanceAnalyzer 구현 (Task 20-23)
- [ ] PromptOptimizer 구현 (Task 24-27)
- [ ] BestPracticeService 구현 (Task 28-30)
- [ ] Vector search 정확도 85%+
- [ ] Workload 밸런스 (편차 <5)

**최종 검증:**

```bash
pnpm --filter @hollon-ai/server test:all
curl -s "http://localhost:3001/documents?type=knowledge" | jq 'length'  # 30+
```

---

## 🎯 성공 기준

1. **기능 완성도**: 모든 서비스 구현, 테스트 85%+
2. **자율성 85%**: 자동 할당, PR 생성, Code Review
3. **품질 A급**: ESLint 0 에러, PR 리뷰 90+
4. **학습 효과**: Document 자동 생성 100%, 효율성 20% 향상
