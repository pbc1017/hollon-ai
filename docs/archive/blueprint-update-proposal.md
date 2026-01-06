# Blueprint.md 업데이트 제안서

> **작성일**: 2025-12-12
> **목적**: Phase 4, Phase 5 재설계에 따른 Blueprint 업데이트
> **상태**: 제안 (검토 필요)

---

## 📊 변경 요약

### 핵심 변경사항

1. **Phase 4 확장**: 4주 → 6주 (협업 시스템 추가)
2. **Phase 3 미룬 기능 재배치**: Channel, 자동 회의, Contract 등
3. **Phase 5 구체화**: UI 중점, 외부 연동 강화
4. **SSOT 완전 달성**: Phase 5 완료 시 100% 구현

---

## 🔄 Phase별 변경 내용

### Phase 4: 학습 및 성장

#### 변경 전 (4주)

```
Week 1-2: 지식 추출 및 Vector RAG
├── KnowledgeExtractionService
├── VectorSearchService
└── KnowledgeGraphService

Week 3-4: 자기 개선 시스템
├── PerformanceAnalyzer
├── PromptOptimizer
└── BestPracticeService
```

#### 변경 후 (6주, 3개 스프린트) ⭐

```
Phase 4.1 (Week 1-2): 지식 시스템 (Knowledge Extraction + Vector/Graph RAG)
├── KnowledgeExtractionService (Task 완료 → Document 자동 생성)
├── VectorSearchService (pgvector + OpenAI embedding)
├── KnowledgeGraphService (document_relationships)
└── PromptComposerService 통합 (Vector + Graph RAG)

Phase 4.2 (Week 3-4): 실시간 협업 인프라 ⭐ 신규
├── Channel Entity & Service (그룹 채팅, SSOT § 4.4)
├── ❌ StandupService 제거 (불필요한 주기적 회의)
├── ❌ RetrospectiveService 제거 (주기적 회고 비효율)
├── ✅ ContinuousImprovementService (실시간 성과 분석)
└── MessageListener 개선 (Channel 통합)

Phase 4.3 (Week 5-6): 메모리 및 자기 개선
├── PerformanceAnalyzer (성과 메트릭 수집 및 분석)
├── PromptOptimizer (Prompt 효과 분석, 토큰 15% 절감)
└── BestPracticeService (고성과 패턴 학습)
```

**변경 이유**:

- Phase 3에서 미룬 협업 기능 (Channel, 자동 회의) 통합
- SSOT § 4.4 (협업 흐름), § 8.2 (정기 회의 자동화) 달성
- 논리적 순서: 지식 → 협업 → 최적화

**영향**:

- Phase 4 기간: +2주
- SSOT 달성도: 85% → 95%

---

### Phase 5: 웹 UI 및 외부 연동

#### 변경 전 (6주)

```
Week 25-26: 대시보드
├── Next.js 14 앱 설정
├── 조직도 뷰 (React Flow)
├── 프로젝트 대시보드
└── 홀론 상세 뷰

Week 27-28: 상호작용 인터페이스
├── 대화 인터페이스
├── 승인 센터
└── 목표 설정 UI

Week 29-30: 외부 연동
├── GitHubIntegrationService
├── SlackIntegrationService
└── WebhookService
```

#### 변경 후 (6주, 3개 스프린트) ⭐

```
Phase 5.1 (Week 1-2): Backend API & CLI Tool ⭐ 신규
├── HollonActionsController (Hollon 자율 액션 API)
├── Hollon CLI Tool (LLM이 직접 사용 가능한 CLI)
│   ├── hollon-cli notify (부모/팀 알림)
│   ├── hollon-cli ask (팀 질문)
│   ├── hollon-cli escalate (블로커 에스컬레이션)
│   └── hollon-cli search (지식 검색)
├── Passive → Active Hollon (Cron 의존 → 자율 행동)
└── Next.js 14 프로젝트 초기 설정

Phase 5.2 (Week 3-4): Interactive Web UI
├── Approval Center (승인 워크플로우, SSOT § 6.2)
├── Goal 설정 UI (폼 + 검증)
├── Channel UI (협업 채팅, Slack 스타일)
├── Message UI (1:1 DM)
└── 대시보드 및 모니터링 UI

Phase 5.3 (Week 5-6): 외부 연동 + 미구현 기능 완성
├── GitHub Integration (PR/Issue 동기화)
├── Slack Integration (알림 및 Slash 커맨드)
├── Contract 시스템 (팀 간 협업 계약, SSOT § 8.3)
├── 자율 Goal 제안 (초기 버전, SSOT § 6.8)
└── Incident Response 고도화 (자동 감지, RCA)
```

**변경 이유**:

- UI 기능 구체화 (WebSocket, Channel UI 등)
- Phase 3/4에서 미룬 기능 완성 (Contract, 자율 Goal)
- SSOT 100% 달성

**영향**:

- SSOT 달성도: 90% → 100%
- 프로덕션 준비도: 95%

---

## 📋 Phase 3 미룬 기능 재배치

| 기능                       | SSOT 참조  | 현재 상태   | 배치              |
| -------------------------- | ---------- | ----------- | ----------------- |
| **Channel (그룹 채팅)**    | § 4.4, § 3 | ❌ 미구현   | Phase 4.2         |
| ~~**자동 Standup**~~       | ~~§ 8.2~~  | ❌ **제거** | -                 |
| ~~**자동 Retrospective**~~ | ~~§ 8.2~~  | ❌ **제거** | -                 |
| **ContinuousImprovement**  | § 7.3      | ❌ 미구현   | Phase 4.2 ✅      |
| **Vector/Graph RAG**       | § 5.6      | ⚠️ 부분     | Phase 4.1         |
| **Hollon CLI Tool**        | § 5.5      | ❌ 미구현   | Phase 5.1 ✅ 신규 |
| **Contract 시스템**        | § 8.3      | ❌ 미구현   | Phase 5.3         |
| **자율 Goal 생성**         | § 6.8      | ❌ 미구현   | Phase 5.3 (초기)  |

---

## ✅ SSOT 달성도 추이

### Phase별 SSOT 달성도

| Phase              | 달성도      | 주요 달성 항목                   |
| ------------------ | ----------- | -------------------------------- |
| Phase 1-2          | 30%         | 기본 인프라                      |
| Phase 3            | 75%         | 자율 워크플로우                  |
| **Phase 4 (수정)** | **95%** ⭐  | **협업 + 지식 + 최적화**         |
| **Phase 5**        | **100%** ⭐ | **UI + 외부 연동 + 미구현 완성** |

### SSOT 섹션별 달성도

| SSOT 섹션 | 내용                  | Phase 3 | Phase 4 | Phase 5     |
| --------- | --------------------- | ------- | ------- | ----------- |
| § 1-2     | 비전 & 아키텍처       | ✅      | ✅      | ✅          |
| § 3       | 핵심 엔티티           | ✅      | ✅      | ✅ + UI     |
| § 4       | 시스템 작동 방식      | ✅      | ✅      | ✅ + UI     |
| § 5       | 핵심 원칙             | ✅      | ✅      | ✅          |
| § 6.1-6.7 | 자율 운영 정책        | ✅      | ✅      | ✅          |
| **§ 6.8** | **자율 Goal 생성**    | ❌      | ❌      | **✅ 초기** |
| § 7       | LLM 한계 대응         | ✅      | ✅      | ✅          |
| § 8.1     | 코드 리뷰             | ✅      | ✅      | ✅          |
| **§ 8.2** | **정기 회의 자동화**  | ❌      | **✅**  | **✅ + UI** |
| **§ 8.3** | **Contract 시스템**   | ❌      | ❌      | **✅**      |
| **§ 8.4** | **Incident Response** | ⚠️      | ⚠️      | **✅**      |

---

## 🎯 Blueprint.md 수정 위치

### 수정 대상 라인

blueprint.md의 Phase 4, Phase 5 섹션 (라인 약 4208-4260):

```diff
### Phase 4: 학습 및 성장 - 4주
+ ### Phase 4: 학습 및 성장 - 6주

핵심 목표: **홀론이 경험에서 학습하고 프롬프트를 스스로 최적화**

```

- Week 1-2: 지식 추출 및 Vector RAG

* Week 1-2: 지식 시스템 (Knowledge Extraction + Vector/Graph RAG)
  ├── KnowledgeExtractionService (Task 완료 → Document 자동 생성)
  ├── VectorSearchService (pgvector + OpenAI embedding)

- └── KnowledgeGraphService (document_relationships)

* ├── KnowledgeGraphService (document_relationships)
* └── PromptComposerService 통합 (Vector + Graph RAG)

* Week 3-4: 협업 시스템 (Channel + 자동 회의)
* ├── Channel Entity & Service (그룹 채팅)
* ├── StandupService (매일 09:00 자동 회의)
* ├── RetrospectiveService (사이클 종료 시)
* └── MessageListener 개선 (Channel 통합)

- Week 3-4: 자기 개선 시스템

* Week 5-6: 메모리 및 자기 개선
  ├── PerformanceAnalyzer (성과 메트릭 수집 및 분석)
  ├── PromptOptimizer (Prompt 효과 분석 및 최적화)
  └── BestPracticeService (고성과 패턴 학습)

````

---

### Phase 5: 웹 UI 및 외부 연동 - 6주

```diff
- Week 25-26: 대시보드
+ Week 1-2: UI 인프라 및 대시보드
├── Next.js 14 앱 설정
├── 조직도 뷰 (React Flow)
├── 프로젝트 대시보드
- └── 홀론 상세 뷰
+ ├── 홀론 상세 뷰
+ └── 실시간 업데이트 (WebSocket)

- Week 27-28: 상호작용 인터페이스
- ├── 대화 인터페이스
+ Week 3-4: 상호작용 UI
├── 승인 센터
└── 목표 설정 UI
+ ├── Channel UI (협업 채팅)
+ └── Message UI (1:1 DM)

- Week 29-30: 외부 연동
+ Week 5-6: 외부 연동 + 미구현 기능 완성
├── GitHubIntegrationService
├── SlackIntegrationService
- └── WebhookService
+ ├── WebhookService
+ ├── ContractService (팀 간 협업 계약)
+ ├── GoalProposalService (자율 Goal 제안 초기 버전)
+ └── IncidentService 고도화
````

---

## 📝 관련 문서

### 신규 작성 문서

1. **`docs/phase4-revised-plan.md`** ✅ 작성 완료
   - Phase 4 수정 계획 상세 (6주)
   - 주차별 구현 내용
   - 코드 예시 및 테스트

2. **`docs/phase5-plan.md`** ✅ 작성 완료
   - Phase 5 계획 상세
   - UI 컴포넌트 구조
   - 외부 연동 명세

### 기존 문서

3. **`docs/phase4-dogfood-plan.md`** → **DEPRECATED**
   - `docs/phase4-revised-plan.md`로 대체
   - 기존 4주 계획은 참고용으로 유지

---

## 🎯 체크리스트

### Blueprint.md 업데이트

- [ ] Phase 4 섹션 수정 (4주 → 6주, 협업 시스템 추가)
- [ ] Phase 5 섹션 수정 (UI 구체화, 미구현 기능 완성)
- [ ] Week 번호 조정 (기존 Week 25-30 → Week 1-6으로 변경)
- [ ] SSOT 참조 추가 (각 기능에 SSOT 섹션 번호 명시)

### 문서 정리

- [x] `docs/phase4-revised-plan.md` 작성
- [x] `docs/phase5-plan.md` 작성
- [x] `docs/blueprint-update-proposal.md` 작성 (본 문서)
- [ ] `docs/phase4-dogfood-plan.md`에 DEPRECATED 표시 추가

### 검증

- [ ] Phase 4 → Phase 5 → SSOT 매핑 검증
- [ ] 누락된 SSOT 항목 체크
- [ ] 구현 우선순위 검토

---

## 💡 추가 제안

### Phase 3.5 명시

Phase 3 완료 후 Phase 4 사이에 "Phase 3.5 - 자율 워크플로우 안정화" 추가 고려:

- 현재 Phase 3.12까지 완료됨
- Phase 4 진입 전 안정화 기간 필요 시 활용

```
Phase 3: 전략-실행 연결 (Week 13-18)
Phase 3.5: 자율 워크플로우 안정화 (추가 2주, 선택적)
Phase 4: 학습 및 성장 (Week 19-24, 6주)
Phase 5: 웹 UI 및 외부 연동 (Week 25-30, 6주)
```

### Phase 6+ 로드맵

Phase 5 완료 후 고려사항:

- **Phase 6: 확장성 및 최적화** (4주)
  - 대규모 Task 처리 최적화
  - 멀티 Organization 관리
  - 고급 RBAC

- **Phase 7: 고급 자율 기능** (4주)
  - 자율 Goal 생성 고도화 (학습 루프)
  - 자율 Architecture Decision
  - 자율 Refactoring 제안

---

## 📊 타임라인 비교

### 변경 전

```
Phase 1: 6주 (Week 1-6)
Phase 2: 6주 (Week 7-12)
Phase 3: 6주 (Week 13-18)
Phase 4: 4주 (Week 19-22)
Phase 5: 6주 (Week 23-28)
총: 28주
```

### 변경 후

```
Phase 1: 6주 (Week 1-6)
Phase 2: 6주 (Week 7-12)
Phase 3: 6주 (Week 13-18)
Phase 4: 6주 (Week 19-24) ⭐ +2주
Phase 5: 6주 (Week 25-30)
총: 30주
```

**영향**: 전체 일정 +2주 (협업 시스템 추가 구현 시간)

---

## ✅ 승인 필요 사항

이 제안서를 검토하고 다음 사항에 대한 결정이 필요합니다:

1. **Phase 4 확장 승인** (4주 → 6주)
   - 협업 시스템 추가 구현 승인
   - 전체 일정 +2주 승인

2. **Blueprint.md 업데이트 승인**
   - Phase 4, Phase 5 섹션 수정
   - SSOT 참조 추가

3. **Phase 3 미룬 기능 재배치 승인**
   - Channel → Phase 4
   - Contract → Phase 5
   - 자율 Goal → Phase 5

---

## 📝 변경 이력

| 날짜       | 버전 | 변경 내용                           |
| ---------- | ---- | ----------------------------------- |
| 2025-12-12 | 1.0  | Blueprint 업데이트 제안서 초안 작성 |

---

**문서 버전**: 1.0
**최종 업데이트**: 2025-12-12
**작성자**: Claude Code
**상태**: 제안 (검토 대기 중)
