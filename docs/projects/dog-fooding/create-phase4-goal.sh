#!/bin/bash

# Phase 4.1 Goal Creation Script
# Prerequisites: Steps 1-4 completed from PRE_GOAL_CHECKLIST.md

ORGANIZATION_ID="a26650af-3d00-47c5-9ecc-e4dc7723a237"
BACKEND_TEAM_ID="20762c9e-5131-4336-8ea0-f2334d03cfad"
TECHLEAD_ALPHA_ID="8b974c6f-a1e3-49f5-86df-8ed09c64d389"

curl -X POST http://localhost:3001/api/goals \
  -H "Content-Type: application/json" \
  -d '{
  "organizationId": "'${ORGANIZATION_ID}'",
  "teamId": "'${BACKEND_TEAM_ID}'",
  "ownerHollonId": "'${TECHLEAD_ALPHA_ID}'",
  "title": "Phase 4.1: 지식 시스템 구축",
  "description": "Task 완료 후 자동으로 지식이 축적되고, 다음 Task 실행 시 자동으로 참조되는 시스템 구현\n\n참고: docs/phases/phase4-revised-plan.md의 Phase 4.1 섹션\n\n구현 범위:\n1. KnowledgeExtractionService - Task 완료 후 지식 추출\n2. VectorSearchService - 문서 임베딩 및 유사도 검색 (정확도 85%+)\n3. KnowledgeGraphService - 지식 관계 그래프\n4. PromptComposerService - 컨텍스트 주입\n5. E2E 테스트 (90%+ 통과)",
  "priority": "high",
  "successCriteria": [
    "KnowledgeExtractionService 구현 완료 (Task completion event 처리)",
    "VectorSearchService 구현 완료 (정확도 85% 이상)",
    "KnowledgeGraphService 구현 완료 (관계 추적)",
    "PromptComposerService 통합 완료 (자동 컨텍스트 주입)",
    "E2E 테스트 90% 이상 통과"
  ]
}'

echo ""
echo "Goal created! Check the response above for the Goal ID."
echo ""
echo "Next steps:"
echo "1. Start the server: pnpm --filter @hollon-ai/server dev"
echo "2. Monitor GoalAutomationListener cron logs (every 1 minute)"
echo "3. Watch for automatic Task decomposition by TechLead-Alpha"
echo "4. Track Task execution by team Hollons"
