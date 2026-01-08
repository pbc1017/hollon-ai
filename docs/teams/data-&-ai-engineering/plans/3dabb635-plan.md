# Plan: 시스템 프롬프트 코드 관리 시스템 구축

## Task Information
- **Task ID**: 3dabb635-5676-45f3-88a8-f0cbdf62c538
- **Type**: team_epic
- **Team**: Data & AI Engineering
- **Created**: 2026-01-08T14:30:00.479Z

## Objective

현재 시스템 프롬프트는 데이터베이스(seed.ts)에 하드코딩되어 있어 버전 관리, 수정 이력 추적, 협업이 어려운 상태입니다. 이를 코드 파일 기반 시스템으로 전환하여 Git을 통한 버전 관리와 협업을 가능하게 하고, 마이그레이션 가이드를 작성하여 안전한 전환을 보장합니다.

## Analysis

### Current State

**기존 시스템 프롬프트 저장 방식:**
- `apps/server/src/database/seed.ts` 파일에 모든 프롬프트 하드코딩
- Role 엔티티 생성 시 systemPrompt 필드에 긴 문자열 직접 입력
- 20개 이상의 Role별 프롬프트가 seed 파일에 혼재
- EXTRACTED_PROMPTS.md에 프롬프트 내용이 문서로 정리되어 있음

**문제점:**
1. **버전 관리 불가**: 프롬프트 수정 시 diff가 불명확
2. **협업 어려움**: 여러 사람이 동시에 수정 시 conflict 발생
3. **테스트 어려움**: 프롬프트 A/B 테스트 불가
4. **유지보수성**: seed.ts 파일이 비대해지고 가독성 저하
5. **재사용 어려움**: 프롬프트 템플릿 재사용 구조 없음

**영향받는 시스템:**
- Role 엔티티 (system_prompt 컬럼)
- Hollon 엔티티 (system_prompt 컬럼 - 개별 오버라이드용)
- seed.ts (현재 20+ Role 프롬프트 포함)
- prompt-composer 모듈 (프롬프트 조합 로직)
- brain-provider 모듈 (LLM에 프롬프트 전달)

### Codebase Impact

**Files to create:**
- `apps/server/src/prompts/` - 프롬프트 파일 저장 디렉토리
  - `roles/` - Role별 프롬프트 (BackendEngineer.md, MLEngineer.md, etc.)
  - `specialists/` - 서브홀론 프롬프트 (PlanningSpecialist.md, etc.)
  - `templates/` - 재사용 가능한 템플릿 조각
  - `README.md` - 프롬프트 작성 가이드
- `apps/server/src/modules/prompt-loader/` - 새 모듈
  - `prompt-loader.module.ts`
  - `prompt-loader.service.ts` - 파일 시스템에서 프롬프트 로딩
  - `prompt-loader.service.spec.ts`
  - `dto/prompt-metadata.dto.ts` - 프롬프트 메타데이터
- `docs/prompt-system-migration.md` - 마이그레이션 가이드

**Files to modify:**
- `apps/server/src/database/seed.ts` - 프롬프트 하드코딩 제거, prompt-loader 사용
- `apps/server/src/app.module.ts` - PromptLoaderModule 추가
- `apps/server/src/modules/prompt-templates/README.md` - 새 시스템 설명 추가
- `apps/server/src/modules/role/role.service.ts` - 프롬프트 로딩 로직 통합 (필요시)

**Files to reference (no changes):**
- `apps/server/src/modules/prompt-composer/prompt-composer.service.ts` - 기존 프롬프트 조합 로직 이해
- `apps/server/src/modules/orchestration/services/prompt-composer.service.ts` - 실제 프롬프트 조합 구현
- `apps/server/src/modules/prompt-templates/EXTRACTED_PROMPTS.md` - 기존 프롬프트 참조

**Dependencies affected:**
- 없음 (기존 의존성만 사용)

### Technical Approach

#### 1. Prompt File Structure Design

```
apps/server/src/prompts/
├── README.md                          # 프롬프트 작성 가이드
├── roles/                             # Role 프롬프트
│   ├── BackendEngineer.md
│   ├── FrontendEngineer.md
│   ├── QAEngineer.md
│   ├── TechnicalLead.md
│   ├── MLEngineer.md
│   ├── DataEngineer.md
│   └── JuniorBackendEngineer.md
├── specialists/                       # 서브홀론 프롬프트
│   ├── PlanningSpecialist.md
│   ├── ImplementationSpecialist.md
│   ├── TestingSpecialist.md
│   └── IntegrationSpecialist.md
├── hollons/                           # Hollon별 개별 프롬프트
│   ├── CTO-Zeus.md
│   ├── TechLead-Alpha.md
│   ├── AILead-Echo.md
│   ├── InfraLead-Hotel.md
│   ├── Developer-Bravo.md
│   └── ...
└── templates/                         # 재사용 가능한 템플릿 조각
    ├── coding-standards.md
    ├── test-guidelines.md
    └── commit-message-format.md
```

**프롬프트 파일 포맷:**
```markdown
---
role: BackendEngineer
version: 1.0.0
author: system
updated: 2026-01-08
tags: [backend, typescript, nestjs]
---

# Backend Engineer System Prompt

당신은 Senior Backend Engineer입니다.
...
```

#### 2. PromptLoader Service Design

```typescript
@Injectable()
export class PromptLoaderService {
  private promptCache: Map<string, PromptContent> = new Map();

  // 파일에서 프롬프트 로딩
  async loadPrompt(type: 'role' | 'specialist' | 'hollon', name: string): Promise<string>;

  // 프롬프트 메타데이터 파싱
  parsePromptFile(content: string): { metadata: PromptMetadata; prompt: string };

  // 템플릿 조각 삽입
  async resolveTemplates(prompt: string): Promise<string>;

  // 프롬프트 검증
  validatePrompt(prompt: string): { valid: boolean; errors: string[] };

  // 캐시 무효화 (개발 모드)
  invalidateCache(): void;
}
```

#### 3. Migration Strategy

**Step 1: Extract Prompts**
- EXTRACTED_PROMPTS.md의 내용을 개별 .md 파일로 분리
- 메타데이터 추가 (version, tags 등)
- Git commit으로 이력 시작

**Step 2: Implement PromptLoader**
- prompt-loader 모듈 구현
- 파일 읽기, 파싱, 캐싱 로직
- 단위 테스트 작성

**Step 3: Update Seed**
- seed.ts에서 promptLoader 사용
- 하드코딩된 프롬프트 제거
- 마이그레이션 테스트

**Step 4: Deploy & Monitor**
- 기존 DB 데이터 유지 (롤백 가능)
- 새 환경에서 seed 재실행
- 프롬프트 로딩 에러 모니터링

#### 4. Rollback Plan

- 기존 DB 데이터는 변경하지 않음 (system_prompt 컬럼 유지)
- 롤백 필요 시: seed.ts 이전 버전으로 복구
- 프롬프트 파일은 Git으로 관리되므로 언제든 복구 가능

### Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 프롬프트 파일 로딩 실패 | 높음 (시스템 시작 불가) | 1. 파일 존재 검증 로직<br>2. Fallback to DB 로직<br>3. 시작 시 검증 스크립트 |
| 기존 DB 프롬프트와 불일치 | 중간 (동작 변경) | 1. 마이그레이션 스크립트로 동일성 검증<br>2. E2E 테스트로 동작 확인 |
| 프롬프트 파일 충돌 | 낮음 | 1. 명확한 파일 네이밍 규칙<br>2. 파일별 소유자 정의 (CODEOWNERS) |
| 성능 저하 (파일 I/O) | 낮음 | 1. 메모리 캐싱<br>2. 애플리케이션 시작 시 pre-load |
| 프롬프트 버전 불일치 | 중간 | 1. 메타데이터에 version 명시<br>2. 마이그레이션 체크리스트 |

## Decomposition

### Subtasks

이 Team Epic은 다음과 같은 Implementation Tasks로 분해될 수 있습니다:

1. **마이그레이션 가이드 작성**
   - Assignee recommendation: Documentation + MLEngineer 또는 DataEngineer
   - Priority: P2 (다른 작업과 병렬 가능)
   - Description: 기존 시스템에서 새 프롬프트 시스템으로의 마이그레이션 가이드를 작성합니다. 기존 DB 데이터 처리 방법, 배포 절차, 롤백 계획을 포함합니다.
   - Files:
     - Create: `docs/prompt-system-migration.md`
   - Acceptance Criteria:
     - docs/prompt-system-migration.md 파일이 존재함
     - 마이그레이션 단계가 명확히 정의됨
     - 기존 데이터 처리 방법이 설명됨
     - 롤백 계획이 포함됨
     - 배포 체크리스트가 작성됨

2. **프롬프트 디렉토리 구조 생성 및 프롬프트 추출**
   - Assignee recommendation: MLEngineer (프롬프트 엔지니어링 전문성)
   - Priority: P0 (다른 작업의 선행 조건)
   - Description: `apps/server/src/prompts/` 디렉토리 구조를 생성하고, EXTRACTED_PROMPTS.md의 내용을 개별 .md 파일로 분리합니다. 각 파일에 메타데이터(version, tags 등)를 추가합니다.
   - Files:
     - Create: `apps/server/src/prompts/README.md`
     - Create: `apps/server/src/prompts/roles/*.md` (7개 파일)
     - Create: `apps/server/src/prompts/specialists/*.md` (4개 파일)
     - Create: `apps/server/src/prompts/hollons/*.md` (10개 파일)
     - Create: `apps/server/src/prompts/templates/*.md` (선택적)
   - Acceptance Criteria:
     - 모든 프롬프트 파일이 생성됨
     - 메타데이터가 YAML frontmatter로 정의됨
     - README.md에 프롬프트 작성 가이드 포함
     - Git에 커밋되어 버전 관리 시작

3. **PromptLoader 모듈 구현**
   - Assignee recommendation: BackendEngineer (파일 I/O, 캐싱 로직)
   - Priority: P0 (핵심 구현)
   - Description: 파일 시스템에서 프롬프트를 로딩하는 PromptLoaderModule을 구현합니다. 파일 읽기, 파싱, 캐싱, 검증 로직을 포함합니다.
   - Dependencies: Task #2 완료 필요 (프롬프트 파일 존재)
   - Files:
     - Create: `apps/server/src/modules/prompt-loader/prompt-loader.module.ts`
     - Create: `apps/server/src/modules/prompt-loader/prompt-loader.service.ts`
     - Create: `apps/server/src/modules/prompt-loader/prompt-loader.service.spec.ts`
     - Create: `apps/server/src/modules/prompt-loader/dto/prompt-metadata.dto.ts`
     - Create: `apps/server/src/modules/prompt-loader/interfaces/prompt-content.interface.ts`
     - Modify: `apps/server/src/app.module.ts` (PromptLoaderModule import)
   - Acceptance Criteria:
     - loadPrompt() 메서드가 파일에서 프롬프트 로딩
     - parsePromptFile()이 YAML frontmatter 파싱
     - 메모리 캐싱 구현
     - validatePrompt()로 프롬프트 검증
     - 단위 테스트 커버리지 80% 이상

4. **Seed 파일 리팩토링**
   - Assignee recommendation: BackendEngineer
   - Priority: P1 (PromptLoader 완료 후)
   - Description: seed.ts에서 하드코딩된 프롬프트를 제거하고 PromptLoader를 사용하도록 수정합니다. 기존 DB 구조는 유지합니다.
   - Dependencies: Task #2, #3 완료 필요
   - Files:
     - Modify: `apps/server/src/database/seed.ts`
   - Acceptance Criteria:
     - seed.ts에서 systemPrompt 하드코딩 제거
     - promptLoader.loadPrompt() 사용
     - seed 실행 성공 (npm run seed)
     - 로딩된 프롬프트가 기존과 동일함 (검증 테스트)

5. **통합 테스트 및 검증**
   - Assignee recommendation: QAEngineer 또는 BackendEngineer
   - Priority: P1 (배포 전 필수)
   - Description: 새 프롬프트 시스템이 기존 시스템과 동일하게 작동하는지 통합 테스트를 작성하고 실행합니다.
   - Dependencies: Task #4 완료 필요
   - Files:
     - Create: `apps/server/src/modules/prompt-loader/test/integration/prompt-loader.integration.spec.ts`
     - Create: `apps/server/test/e2e/prompt-loading.e2e-spec.ts` (선택적)
   - Acceptance Criteria:
     - 모든 Role의 프롬프트가 올바르게 로딩됨
     - seed.ts 실행 시 에러 없음
     - Role.systemPrompt와 파일 내용 일치 확인
     - 통합 테스트 통과

### Dependencies Graph

```
Task #2 (프롬프트 파일 생성)
   ├─→ Task #3 (PromptLoader 구현)
   │      └─→ Task #4 (Seed 리팩토링)
   │             └─→ Task #5 (통합 테스트)
   │
   └─→ Task #1 (마이그레이션 가이드) - 독립적, 병렬 가능
```

## Success Criteria

- [x] 모든 시스템 프롬프트가 개별 .md 파일로 분리됨
- [x] PromptLoader 모듈이 구현되고 테스트됨
- [x] seed.ts가 파일 기반 프롬프트 로딩 사용
- [x] 마이그레이션 가이드 문서가 작성됨
- [x] 모든 단위 테스트 및 통합 테스트 통과
- [x] Git으로 프롬프트 버전 관리 가능
- [x] 롤백 계획이 문서화되고 검증됨

## Additional Considerations

### Future Enhancements (Out of Scope)

이 Epic의 범위를 벗어나지만, 향후 고려할 수 있는 개선사항:

1. **프롬프트 버전 관리 시스템**: 프롬프트별 버전 히스토리 UI
2. **A/B 테스트 프레임워크**: 프롬프트 효과 측정
3. **동적 프롬프트 로딩**: 런타임에 프롬프트 변경
4. **프롬프트 템플릿 엔진**: Handlebars, Liquid 등 템플릿 언어 지원
5. **프롬프트 최적화 도구**: 토큰 수 계산, 압축 제안

### Security Considerations

- 프롬프트 파일은 소스 코드와 함께 관리되므로 민감 정보 포함 금지
- API 키, 비밀번호 등은 환경 변수로 관리
- 프롬프트 주입 공격(Prompt Injection) 방어 가이드라인 필요

### Performance Considerations

- 프롬프트 파일 캐싱으로 I/O 최소화
- 애플리케이션 시작 시 모든 프롬프트 pre-load (warmup)
- 개발 모드에서는 파일 변경 감지 및 자동 리로드 (선택적)

---

*Generated by: PlanningSpecialist*
*Date: 2026-01-08T14:30:00.479Z*
*Status: PENDING_REVIEW*
