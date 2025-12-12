#!/bin/bash

# Phase 4 Dogfooding Setup Script
# Based on: docs/projects/dog-fooding/phase4-implementation-plan.md

set -e  # Exit on error

API_URL="${API_URL:-http://localhost:3000/api}"
COLORED_OUTPUT="${COLORED_OUTPUT:-true}"

# Color codes
if [ "$COLORED_OUTPUT" = "true" ]; then
  GREEN='\033[0;32m'
  BLUE='\033[0;34m'
  YELLOW='\033[1;33m'
  RED='\033[0;31m'
  NC='\033[0m' # No Color
else
  GREEN=''
  BLUE=''
  YELLOW=''
  RED=''
  NC=''
fi

# Helper functions
log() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check if server is running
check_server() {
  log "Checking if server is running at $API_URL..."
  if curl -s -f "$API_URL/organizations" > /dev/null 2>&1; then
    success "Server is running!"
  else
    error "Server is not running at $API_URL"
    error "Please start the server first: pnpm --filter @hollon-ai/server dev"
    exit 1
  fi
}

# Store IDs
ORG_ID=""
BACKEND_TEAM_ID=""
DATA_AI_TEAM_ID=""
QA_TEAM_ID=""

TECH_LEAD_ROLE_ID=""
SENIOR_BACKEND_ROLE_ID=""
SENIOR_BACKEND_EVENT_ROLE_ID=""
JUNIOR_BACKEND_ROLE_ID=""
AI_LEAD_ROLE_ID=""
SENIOR_DATA_ROLE_ID=""
SENIOR_ML_ROLE_ID=""
QA_LEAD_ROLE_ID=""
SENIOR_TEST_ROLE_ID=""

TECHLEAD_ALPHA_ID=""
BACKENDDEV_BRAVO_ID=""
BACKENDDEV_CHARLIE_ID=""
BACKENDDEV_DELTA_ID=""
AILEAD_ECHO_ID=""
DATAENGINEER_FOXTROT_ID=""
MLENGINEER_GOLF_ID=""
QALEAD_HOTEL_ID=""
TESTENGINEER_INDIA_ID=""

# Step 1: Create Organization
create_organization() {
  log "Step 1: Creating Organization 'Hollon AI Development'..."

  RESPONSE=$(curl -s -X POST "$API_URL/organizations" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Hollon AI Development",
      "description": "범용 Hollon 조직 (Phase 4, 5, 6... 모두 수행)"
    }')

  ORG_ID=$(echo "$RESPONSE" | jq -r '.id')

  if [ -z "$ORG_ID" ] || [ "$ORG_ID" = "null" ]; then
    error "Failed to create organization"
    echo "$RESPONSE" | jq '.'
    exit 1
  fi

  success "Organization created: $ORG_ID"
}

# Step 2: Create Teams
create_teams() {
  log "Step 2: Creating Teams..."

  # Backend Engineering
  RESPONSE=$(curl -s -X POST "$API_URL/teams" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Backend Engineering",
      "description": "백엔드 시스템 개발 (NestJS, API, DB)",
      "organizationId": "'"$ORG_ID"'"
    }')
  BACKEND_TEAM_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "Backend Engineering Team created: $BACKEND_TEAM_ID"

  # Data & AI Engineering
  RESPONSE=$(curl -s -X POST "$API_URL/teams" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Data & AI Engineering",
      "description": "데이터 파이프라인, Vector/Graph RAG, LLM 통합",
      "organizationId": "'"$ORG_ID"'"
    }')
  DATA_AI_TEAM_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "Data & AI Engineering Team created: $DATA_AI_TEAM_ID"

  # Quality & Testing
  RESPONSE=$(curl -s -X POST "$API_URL/teams" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Quality & Testing",
      "description": "E2E 테스트, 품질 보증",
      "organizationId": "'"$ORG_ID"'"
    }')
  QA_TEAM_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "Quality & Testing Team created: $QA_TEAM_ID"
}

# Step 3: Create Roles
create_roles() {
  log "Step 3: Creating Roles..."

  # Technical Lead
  RESPONSE=$(curl -s -X POST "$API_URL/roles" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Technical Lead",
      "description": "기술 리더, 시스템 아키텍처 설계 및 Task 분배",
      "capabilities": ["system-design", "backend-architecture", "task-distribution", "code-review", "typescript", "nestjs"],
      "organizationId": "'"$ORG_ID"'"
    }')
  TECH_LEAD_ROLE_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "Technical Lead Role created: $TECH_LEAD_ROLE_ID"

  # Senior Backend Developer
  RESPONSE=$(curl -s -X POST "$API_URL/roles" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Senior Backend Developer",
      "description": "시니어 백엔드 개발자",
      "capabilities": ["typescript", "nestjs", "database-design", "api-development"],
      "organizationId": "'"$ORG_ID"'"
    }')
  SENIOR_BACKEND_ROLE_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "Senior Backend Developer Role created: $SENIOR_BACKEND_ROLE_ID"

  # Senior Backend Developer (Event & Integration)
  RESPONSE=$(curl -s -X POST "$API_URL/roles" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Senior Backend Developer (Event & Integration)",
      "description": "이벤트 기반 시스템 및 외부 연동 전문",
      "capabilities": ["typescript", "nestjs", "event-emitter", "message-queue", "integration"],
      "organizationId": "'"$ORG_ID"'"
    }')
  SENIOR_BACKEND_EVENT_ROLE_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "Senior Backend Developer (Event) Role created: $SENIOR_BACKEND_EVENT_ROLE_ID"

  # Junior Backend Developer
  RESPONSE=$(curl -s -X POST "$API_URL/roles" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Junior Backend Developer",
      "description": "주니어 백엔드 개발자, 테스트 및 문서화",
      "capabilities": ["typescript", "nestjs", "unit-testing", "documentation"],
      "organizationId": "'"$ORG_ID"'"
    }')
  JUNIOR_BACKEND_ROLE_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "Junior Backend Developer Role created: $JUNIOR_BACKEND_ROLE_ID"

  # AI/ML Engineering Lead
  RESPONSE=$(curl -s -X POST "$API_URL/roles" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "AI/ML Engineering Lead",
      "description": "AI/ML 시스템 리더",
      "capabilities": ["machine-learning", "vector-databases", "llm-integration", "data-architecture"],
      "organizationId": "'"$ORG_ID"'"
    }')
  AI_LEAD_ROLE_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "AI/ML Engineering Lead Role created: $AI_LEAD_ROLE_ID"

  # Senior Data Engineer
  RESPONSE=$(curl -s -X POST "$API_URL/roles" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Senior Data Engineer",
      "description": "시니어 데이터 엔지니어",
      "capabilities": ["typescript", "nestjs", "pgvector", "graph-databases", "data-pipeline"],
      "organizationId": "'"$ORG_ID"'"
    }')
  SENIOR_DATA_ROLE_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "Senior Data Engineer Role created: $SENIOR_DATA_ROLE_ID"

  # Senior ML Engineer
  RESPONSE=$(curl -s -X POST "$API_URL/roles" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Senior ML Engineer",
      "description": "시니어 ML 엔지니어",
      "capabilities": ["typescript", "nestjs", "openai-api", "prompt-engineering", "embeddings"],
      "organizationId": "'"$ORG_ID"'"
    }')
  SENIOR_ML_ROLE_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "Senior ML Engineer Role created: $SENIOR_ML_ROLE_ID"

  # QA Engineering Lead
  RESPONSE=$(curl -s -X POST "$API_URL/roles" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "QA Engineering Lead",
      "description": "QA 리더",
      "capabilities": ["test-strategy", "e2e-testing", "quality-assurance"],
      "organizationId": "'"$ORG_ID"'"
    }')
  QA_LEAD_ROLE_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "QA Engineering Lead Role created: $QA_LEAD_ROLE_ID"

  # Senior Test Engineer
  RESPONSE=$(curl -s -X POST "$API_URL/roles" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Senior Test Engineer",
      "description": "시니어 테스트 엔지니어",
      "capabilities": ["typescript", "jest", "e2e-testing", "integration-testing"],
      "organizationId": "'"$ORG_ID"'"
    }')
  SENIOR_TEST_ROLE_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "Senior Test Engineer Role created: $SENIOR_TEST_ROLE_ID"
}

# Step 4: Create Hollons
create_hollons() {
  log "Step 4: Creating Hollons..."

  # TechLead-Alpha (Manager of Backend Engineering)
  RESPONSE=$(curl -s -X POST "$API_URL/hollons" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "TechLead-Alpha",
      "organizationId": "'"$ORG_ID"'",
      "teamId": "'"$BACKEND_TEAM_ID"'",
      "roleId": "'"$TECH_LEAD_ROLE_ID"'",
      "systemPrompt": "저는 기술적 리더십을 발휘하여 시스템을 설계하고, 팀원들에게 적절한 Task를 배분합니다. 요구사항을 분석하고 최적의 아키텍처를 제안합니다.",
      "lifecycle": "permanent"
    }')
  TECHLEAD_ALPHA_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "TechLead-Alpha created: $TECHLEAD_ALPHA_ID"

  # BackendDev-Bravo (Senior Backend Developer)
  RESPONSE=$(curl -s -X POST "$API_URL/hollons" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "BackendDev-Bravo",
      "organizationId": "'"$ORG_ID"'",
      "teamId": "'"$BACKEND_TEAM_ID"'",
      "roleId": "'"$SENIOR_BACKEND_ROLE_ID"'",
      "systemPrompt": "저는 백엔드 시스템을 구현합니다. TypeScript와 NestJS를 활용하여 확장 가능하고 유지보수하기 쉬운 코드를 작성합니다.",
      "lifecycle": "permanent"
    }')
  BACKENDDEV_BRAVO_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "BackendDev-Bravo created: $BACKENDDEV_BRAVO_ID"

  # BackendDev-Charlie (Senior Backend Developer - Event & Integration)
  RESPONSE=$(curl -s -X POST "$API_URL/hollons" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "BackendDev-Charlie",
      "organizationId": "'"$ORG_ID"'",
      "teamId": "'"$BACKEND_TEAM_ID"'",
      "roleId": "'"$SENIOR_BACKEND_EVENT_ROLE_ID"'",
      "systemPrompt": "저는 이벤트 기반 시스템과 외부 연동을 담당합니다. Listener, Queue, Integration을 구현합니다.",
      "lifecycle": "permanent"
    }')
  BACKENDDEV_CHARLIE_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "BackendDev-Charlie created: $BACKENDDEV_CHARLIE_ID"

  # BackendDev-Delta (Junior Backend Developer)
  RESPONSE=$(curl -s -X POST "$API_URL/hollons" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "BackendDev-Delta",
      "organizationId": "'"$ORG_ID"'",
      "teamId": "'"$BACKEND_TEAM_ID"'",
      "roleId": "'"$JUNIOR_BACKEND_ROLE_ID"'",
      "systemPrompt": "저는 주니어 개발자로서 단위 테스트 작성과 문서화를 담당합니다. 시니어 개발자의 코드를 학습하며 성장합니다.",
      "lifecycle": "permanent"
    }')
  BACKENDDEV_DELTA_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "BackendDev-Delta created: $BACKENDDEV_DELTA_ID"

  # AILead-Echo (Manager of Data & AI Engineering)
  RESPONSE=$(curl -s -X POST "$API_URL/hollons" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "AILead-Echo",
      "organizationId": "'"$ORG_ID"'",
      "teamId": "'"$DATA_AI_TEAM_ID"'",
      "roleId": "'"$AI_LEAD_ROLE_ID"'",
      "systemPrompt": "저는 AI/ML 시스템을 설계하고, 데이터 파이프라인을 구축합니다. Vector RAG, Graph RAG, Prompt 최적화 등을 담당합니다.",
      "lifecycle": "permanent"
    }')
  AILEAD_ECHO_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "AILead-Echo created: $AILEAD_ECHO_ID"

  # DataEngineer-Foxtrot (Senior Data Engineer)
  RESPONSE=$(curl -s -X POST "$API_URL/hollons" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "DataEngineer-Foxtrot",
      "organizationId": "'"$ORG_ID"'",
      "teamId": "'"$DATA_AI_TEAM_ID"'",
      "roleId": "'"$SENIOR_DATA_ROLE_ID"'",
      "systemPrompt": "저는 데이터 엔지니어로서 Vector 검색, Graph 탐색, 데이터 파이프라인을 구축합니다.",
      "lifecycle": "permanent"
    }')
  DATAENGINEER_FOXTROT_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "DataEngineer-Foxtrot created: $DATAENGINEER_FOXTROT_ID"

  # MLEngineer-Golf (Senior ML Engineer)
  RESPONSE=$(curl -s -X POST "$API_URL/hollons" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "MLEngineer-Golf",
      "organizationId": "'"$ORG_ID"'",
      "teamId": "'"$DATA_AI_TEAM_ID"'",
      "roleId": "'"$SENIOR_ML_ROLE_ID"'",
      "systemPrompt": "저는 ML 엔지니어로서 LLM 통합, Embedding 생성, Prompt 최적화를 담당합니다.",
      "lifecycle": "permanent"
    }')
  MLENGINEER_GOLF_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "MLEngineer-Golf created: $MLENGINEER_GOLF_ID"

  # QALead-Hotel (Manager of Quality & Testing)
  RESPONSE=$(curl -s -X POST "$API_URL/hollons" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "QALead-Hotel",
      "organizationId": "'"$ORG_ID"'",
      "teamId": "'"$QA_TEAM_ID"'",
      "roleId": "'"$QA_LEAD_ROLE_ID"'",
      "systemPrompt": "저는 QA 리더로서 테스트 전략을 수립하고, 품질을 보증합니다. E2E 테스트 시나리오를 설계합니다.",
      "lifecycle": "permanent"
    }')
  QALEAD_HOTEL_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "QALead-Hotel created: $QALEAD_HOTEL_ID"

  # TestEngineer-India (Senior Test Engineer)
  RESPONSE=$(curl -s -X POST "$API_URL/hollons" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "TestEngineer-India",
      "organizationId": "'"$ORG_ID"'",
      "teamId": "'"$QA_TEAM_ID"'",
      "roleId": "'"$SENIOR_TEST_ROLE_ID"'",
      "systemPrompt": "저는 테스트 엔지니어로서 E2E 테스트와 통합 테스트를 작성합니다. 모든 기능이 정상 작동하는지 검증합니다.",
      "lifecycle": "permanent"
    }')
  TESTENGINEER_INDIA_ID=$(echo "$RESPONSE" | jq -r '.id')
  success "TestEngineer-India created: $TESTENGINEER_INDIA_ID"
}

# Step 5: Assign Managers to Teams
assign_managers() {
  log "Step 5: Assigning Managers to Teams..."

  # Backend Engineering → TechLead-Alpha
  curl -s -X PATCH "$API_URL/teams/$BACKEND_TEAM_ID" \
    -H "Content-Type: application/json" \
    -d '{
      "leaderHollonId": "'"$TECHLEAD_ALPHA_ID"'"
    }' > /dev/null
  success "TechLead-Alpha assigned as manager of Backend Engineering"

  # Data & AI Engineering → AILead-Echo
  curl -s -X PATCH "$API_URL/teams/$DATA_AI_TEAM_ID" \
    -H "Content-Type: application/json" \
    -d '{
      "leaderHollonId": "'"$AILEAD_ECHO_ID"'"
    }' > /dev/null
  success "AILead-Echo assigned as manager of Data & AI Engineering"

  # Quality & Testing → QALead-Hotel
  curl -s -X PATCH "$API_URL/teams/$QA_TEAM_ID" \
    -H "Content-Type: application/json" \
    -d '{
      "leaderHollonId": "'"$QALEAD_HOTEL_ID"'"
    }' > /dev/null
  success "QALead-Hotel assigned as manager of Quality & Testing"
}

# Create CTO (Engineering Director)
create_cto() {
  echo ""
  info "Creating CTO (Engineering Director)..."

  # Create CTO Role
  CTO_ROLE_RESPONSE=$(curl -s -X POST "$API_URL/roles" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "CTO / Engineering Director",
      "description": "최고 기술 책임자, 전체 엔지니어링 조직 관리 및 크로스팀 조율",
      "capabilities": [
        "strategic-planning",
        "cross-team-coordination",
        "architecture-governance",
        "resource-allocation",
        "technical-leadership",
        "system-design",
        "backend-architecture"
      ],
      "organizationId": "'"$ORG_ID"'"
    }')

  CTO_ROLE_ID=$(echo "$CTO_ROLE_RESPONSE" | jq -r '.id')
  validate_id "$CTO_ROLE_ID" "CTO Role"
  success "CTO Role created: $CTO_ROLE_ID"

  # Create CTO Hollon
  CTO_HOLLON_RESPONSE=$(curl -s -X POST "$API_URL/hollons" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "CTO-Zeus",
      "organizationId": "'"$ORG_ID"'",
      "roleId": "'"$CTO_ROLE_ID"'",
      "systemPrompt": "저는 CTO로서 전체 엔지니어링 조직을 이끌고 있습니다. 크로스팀 Goal을 분석하여 각 팀에 적절히 분배하고, 팀 간 협업을 조율하며, 전체 아키텍처와 기술 방향성을 관리합니다. 복잡한 Goal을 받으면 관련된 모든 팀을 파악하고 각 팀의 Manager에게 명확한 책임과 인터페이스를 정의하여 Team Epic을 할당합니다.",
      "lifecycle": "permanent"
    }')

  CTO_HOLLON_ID=$(echo "$CTO_HOLLON_RESPONSE" | jq -r '.id')
  validate_id "$CTO_HOLLON_ID" "CTO-Zeus"
  success "CTO-Zeus created: $CTO_HOLLON_ID"

  # Set CTO as manager for all team managers
  info "Setting CTO-Zeus as manager of team managers..."

  curl -s -X PATCH "$API_URL/hollons/$TECHLEAD_ALPHA_ID" \
    -H "Content-Type: application/json" \
    -d '{"managerId": "'"$CTO_HOLLON_ID"'"}' > /dev/null
  success "CTO-Zeus set as manager of TechLead-Alpha"

  curl -s -X PATCH "$API_URL/hollons/$AILEAD_ECHO_ID" \
    -H "Content-Type: application/json" \
    -d '{"managerId": "'"$CTO_HOLLON_ID"'"}' > /dev/null
  success "CTO-Zeus set as manager of AILead-Echo"

  curl -s -X PATCH "$API_URL/hollons/$QALEAD_HOTEL_ID" \
    -H "Content-Type: application/json" \
    -d '{"managerId": "'"$CTO_HOLLON_ID"'"}' > /dev/null
  success "CTO-Zeus set as manager of QALead-Hotel"
}

# Summary
print_summary() {
  echo ""
  echo "========================================"
  echo "  Phase 4 Dogfooding Setup Complete!"
  echo "========================================"
  echo ""
  echo "Organization: Hollon AI Development"
  echo "  ID: $ORG_ID"
  echo ""
  echo "Organization Structure:"
  echo "  CTO-Zeus (ID: $CTO_HOLLON_ID)"
  echo "  ├── Backend Engineering (Team: $BACKEND_TEAM_ID)"
  echo "  │   ├── TechLead-Alpha (Manager): $TECHLEAD_ALPHA_ID"
  echo "  │   ├── BackendDev-Bravo: $BACKENDDEV_BRAVO_ID"
  echo "  │   ├── BackendDev-Charlie: $BACKENDDEV_CHARLIE_ID"
  echo "  │   └── BackendDev-Delta: $BACKENDDEV_DELTA_ID"
  echo "  ├── Data & AI Engineering (Team: $DATA_AI_TEAM_ID)"
  echo "  │   ├── AILead-Echo (Manager): $AILEAD_ECHO_ID"
  echo "  │   ├── DataEngineer-Foxtrot: $DATAENGINEER_FOXTROT_ID"
  echo "  │   └── MLEngineer-Golf: $MLENGINEER_GOLF_ID"
  echo "  └── Quality & Testing (Team: $QA_TEAM_ID)"
  echo "      ├── QALead-Hotel (Manager): $QALEAD_HOTEL_ID"
  echo "      └── TestEngineer-India: $TESTENGINEER_INDIA_ID"
  echo ""
  echo "Total Hollons: 10 (1 CTO + 3 Team Managers + 6 Team Members)"
  echo ""
  echo "Next Steps:"
  echo ""
  echo "  1. For single-team Goals, assign to Team Manager:"
  echo "    curl -X POST $API_URL/goals \\"
  echo "      -H 'Content-Type: application/json' \\"
  echo "      -d '{"
  echo "        \"title\": \"Phase 4.1: 지식 시스템 구축\","
  echo "        \"description\": \"Task 완료 후 자동으로 지식이 축적되고...\","
  echo "        \"assignedTeamId\": \"'$BACKEND_TEAM_ID'\","
  echo "        \"assignedHollonId\": \"'$TECHLEAD_ALPHA_ID'\","
  echo "        \"acceptanceCriteria\": [\"KnowledgeExtractionService 구현\", ...]"
  echo "      }'"
  echo ""
  echo "  2. For cross-team Goals, assign to CTO:"
  echo "    curl -X POST $API_URL/goals \\"
  echo "      -H 'Content-Type: application/json' \\"
  echo "      -d '{"
  echo "        \"title\": \"Phase 4: Complete Knowledge System\","
  echo "        \"description\": \"Coordinate Backend, Data/AI, and QA teams...\","
  echo "        \"assignedHollonId\": \"'$CTO_HOLLON_ID'\","
  echo "        \"acceptanceCriteria\": [\"All teams coordinated\", ...]"
  echo "      }'"
  echo ""
  echo "  Then wait for GoalAutomationListener (Cron) to:"
  echo "    T+1min: Decompose Goal → Tasks"
  echo "    T+2min: Execute Tasks"
  echo "    T+3min: Review & Merge"
  echo ""
  echo "========================================"
}

# Main execution
main() {
  echo "========================================"
  echo "  Phase 4 Dogfooding Setup Script"
  echo "========================================"
  echo ""

  check_server
  create_organization
  create_teams
  create_roles
  create_hollons
  assign_managers
  create_cto
  print_summary
}

main
