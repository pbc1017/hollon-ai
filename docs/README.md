# 📚 Hollon AI Documentation

> **Last Updated**: 2025-12-12
> **Project Status**: Phase 3 완료, Phase 4 계획 중

---

## 🧭 Quick Navigation

### 📖 Active Documents

| Category             | Document                                                                 | Description                                      |
| -------------------- | ------------------------------------------------------------------------ | ------------------------------------------------ |
| **Principles**       | [`principles/ssot.md`](./principles/ssot.md)                             | Single Source of Truth - 시스템 원칙 및 요구사항 |
| **Testing**          | [`TESTING_STRATEGY.md`](./TESTING_STRATEGY.md)                           | 테스트 전략 및 커버리지 보고서                   |
| **Testing**          | [`TEST_MAINTENANCE.md`](./TEST_MAINTENANCE.md)                           | 테스트 유지보수 가이드라인                       |
| **Testing**          | [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md)                                   | 알려진 이슈 및 기술 부채                         |
| **Current Phase**    | [`phases/phase4-revised-plan.md`](./phases/phase4-revised-plan.md)       | Phase 4 상세 계획 (6주, 3 스프린트)              |
| **Next Phase**       | [`phases/phase5-plan.md`](./phases/phase5-plan.md)                       | Phase 5 상세 계획 (CLI + UI + 완성)              |
| **Redesign Summary** | [`phases/phase-redesign-summary.md`](./phases/phase-redesign-summary.md) | Phase 4/5 재설계 최종안                          |

---

## 📂 Folder Structure

```
docs/
├── README.md (이 문서)
│
├── TESTING_STRATEGY.md     # ⭐ 테스트 전략 및 커버리지 보고서
├── TEST_MAINTENANCE.md     # ⭐ 테스트 유지보수 가이드라인
├── KNOWN_ISSUES.md         # ⭐ 알려진 이슈 및 기술 부채
│
├── principles/              # 시스템 원칙
│   └── ssot.md             # Single Source of Truth
│
├── phases/                 # Phase 계획 (전체)
│   ├── phase1-plan.md      # ✅ 완료
│   ├── phase2-plan.md      # ✅ 완료
│   ├── phase3-plan.md      # ✅ 완료
│   ├── phase4-revised-plan.md    # 📋 현재
│   ├── phase5-plan.md            # 📋 다음
│   └── phase-redesign-summary.md # 재설계 요약
│
├── projects/               # 진행 중 프로젝트
│   ├── ddd-refactoring/   # DDD 리팩토링
│   │   └── ddd-refactoring-plan.md
│   └── dog-fooding/       # Dogfooding 실험
│       ├── DOGFOODING_EXPERIMENT.md
│       ├── dogfooding-2-report.md
│       └── phase4-implementation-plan.md  # ⭐ 신규
│
└── archive/                # 구버전/참고 문서
    ├── README.md
    ├── blueprint.md
    ├── blueprint-update-proposal.md
    ├── phase3-completion-analysis.md
    ├── phase3-integration-plan.md
    ├── phase3.7-plan.md
    ├── phase4-dogfood-plan.md
    ├── hierarchical-task-distribution.md
    └── implementation-plan-project-workflow.md
```

---

## 🎯 Current Phase: Phase 4

**Timeline**: Week 19-24 (6주, 3 스프린트)

### Sprint Breakdown

| Sprint        | Timeline | Focus                                                   |
| ------------- | -------- | ------------------------------------------------------- |
| **Phase 4.1** | Week 1-2 | 지식 시스템 (Knowledge + Vector/Graph RAG)              |
| **Phase 4.2** | Week 3-4 | 실시간 협업 인프라 (Channel + ContinuousImprovement)    |
| **Phase 4.3** | Week 5-6 | 메모리 및 자기 개선 (Performance + Prompt Optimization) |

👉 **상세 계획**: [`phases/phase4-revised-plan.md`](./phases/phase4-revised-plan.md)

**🤖 Dogfooding**: Phase 4 구현을 Hollon에게 자율적으로 맡기는 실험

- 📋 **계획**: [`projects/dog-fooding/phase4-implementation-plan.md`](./projects/dog-fooding/phase4-implementation-plan.md)
- 📊 **이전 실험**: [`projects/dog-fooding/dogfooding-2-report.md`](./projects/dog-fooding/dogfooding-2-report.md)

---

## 🚀 Next Phase: Phase 5

**Timeline**: Week 25-30 (6주, 3 스프린트)

### Sprint Breakdown

| Sprint        | Timeline | Focus                                          |
| ------------- | -------- | ---------------------------------------------- |
| **Phase 5.1** | Week 1-2 | Backend API & CLI Tool (Hollon 자율 행동)      |
| **Phase 5.2** | Week 3-4 | Interactive Web UI (Approval + Channel + Goal) |
| **Phase 5.3** | Week 5-6 | 외부 연동 & 미구현 기능 완성                   |

👉 **상세 계획**: [`phases/phase5-plan.md`](./phases/phase5-plan.md)

---

## 🔑 Key Concepts

### Hollon CLI Tool (Phase 5.1)

**Passive → Active Hollon**:

- 기존: 10분마다 Cron이 Hollon 깨움
- 신규: LLM이 Brain Provider 실행 중 직접 CLI 사용

**CLI Commands**:

```bash
hollon-cli notify parent "50% complete"
hollon-cli ask team "API endpoint 어디?"
hollon-cli escalate "dependency blocked"
hollon-cli search "authentication"
hollon-cli next-task
```

### ContinuousImprovementService (Phase 4.2)

**정기 회의 제거 → 실시간 분석**:

- ❌ 제거: StandupService, RetrospectiveService
- ✅ 추가: Task 완료 시 즉시 학습, Threshold 기반 자동 개선

---

## 📊 Phase Progress

| Phase       | Status         | Timeline       | SSOT Coverage |
| ----------- | -------------- | -------------- | ------------- |
| Phase 1     | ✅ 완료        | Week 1-6       | 10%           |
| Phase 2     | ✅ 완료        | Week 7-12      | 30%           |
| Phase 3     | ✅ 완료        | Week 13-18     | 75%           |
| **Phase 4** | 📋 **계획 중** | **Week 19-24** | **90%**       |
| Phase 5     | 📋 계획        | Week 25-30     | 100%          |

---

## 🚀 Active Projects

### 1. DDD Refactoring

**목적**: Circular Dependency 해결 및 아키텍처 개선

📁 **위치**: [`projects/ddd-refactoring/`](./projects/ddd-refactoring/)

- `ddd-refactoring-plan.md` - 리팩토링 계획

### 2. Dogfooding (Hollon 자율 개발)

**목적**: Hollon이 Hollon 시스템을 개발하도록 위임

📁 **위치**: [`projects/dog-fooding/`](./projects/dog-fooding/)

- `DOGFOODING_EXPERIMENT.md` - 초기 실험
- `dogfooding-2-report.md` - 2차 실험 보고서
- `phase4-implementation-plan.md` - Phase 4 구현 계획 (⭐ 신규)

---

## 🗂️ Archive

완료된 Phase나 구버전 문서는 [`archive/`](./archive/) 폴더에서 참고할 수 있습니다:

- ~~Blueprint 문서~~ (Phase별 상세 계획으로 대체)
- Phase 3 관련 분석/통합 문서
- 구버전 Phase 4 계획 (dogfood)
- 아키텍처 문서 (hierarchical-task-distribution, implementation-plan-project-workflow)

📖 **Archive Guide**: [`archive/README.md`](./archive/README.md)

---

## 📝 Document Conventions

### Naming

- `phase{N}-{topic}.md` - Phase별 계획
- `{topic}-plan.md` - 주제별 계획
- `{topic}-summary.md` - 요약 문서

### Status Indicators

- ✅ 완료
- 🚧 진행중
- 📋 계획
- ⚠️ 부분 구현
- ❌ 미구현/제거

---

## 🎯 Quick Links

### For Developers

- 🎯 [SSOT (원칙)](./principles/ssot.md)
- 📋 [Phase 4 계획](./phases/phase4-revised-plan.md)
- 🏗️ [DDD Refactoring](./projects/ddd-refactoring/ddd-refactoring-plan.md)
- 🧪 [Testing Strategy](./TESTING_STRATEGY.md)
- 📝 [Test Maintenance](./TEST_MAINTENANCE.md)
- ⚠️ [Known Issues](./KNOWN_ISSUES.md)

### For Planning

- 📊 [Phase 4/5 재설계 요약](./phases/phase-redesign-summary.md)
- 🤖 [Dogfooding 실험](./projects/dog-fooding/)

### For Reference

- 📚 [Archive](./archive/README.md)
- 📖 [완료된 Phase 계획](./phases/)

---

**Questions?** Phase 재설계 내용은 [`phases/phase-redesign-summary.md`](./phases/phase-redesign-summary.md)를 참고하세요.
