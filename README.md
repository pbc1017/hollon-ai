# Hollon-AI

> 재귀적 멀티 에이전트 시스템 - 스타트업 조직처럼 협업하는 AI 에이전트

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

## 소개

Hollon-AI는 여러 AI 에이전트가 조직 구조 안에서 자율적으로 협업하는 **재귀적 멀티 에이전트 시스템**입니다.

"Hollon"은 전체이면서 동시에 부분인 개념을 의미합니다. 각 Hollon은:

- **자율적인 개체**: 독립적으로 태스크를 실행
- **조직의 일부**: 팀과 조직 구조 안에서 역할 수행
- **재귀적 구조**: 상위 Hollon의 지시를 받고, 하위 Hollon에게 위임 가능

## 주요 기능

### 자율 태스크 실행

- Claude Code를 통한 지능적인 태스크 분석 및 실행
- 복잡한 태스크의 자동 분해 (Subtask 생성)
- 비용 추적 및 예산 관리

### 협업 시스템

- 조직-팀-역할 기반의 계층 구조
- 실시간 메시지 및 채널 기반 커뮤니케이션
- 스탠드업 미팅 및 스프린트 사이클 관리

### 품질 검증

- Quality Gate를 통한 결과물 검증
- 실패 시 자동 재시도 메커니즘
- 에스컬레이션 정책 (상위 Hollon으로 문제 보고)

## 빠른 시작

### 필수 요구사항

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker & Docker Compose
- PostgreSQL 16
- Claude Code CLI (선택사항, Brain Provider용)

### 설치

```bash
# 저장소 클론
git clone https://github.com/your-org/hollon-ai.git
cd hollon-ai

# 의존성 설치
pnpm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 수정하여 필요한 값 설정

# Docker 서비스 시작 (PostgreSQL, Redis)
pnpm docker:up

# 데이터베이스 마이그레이션
pnpm db:migrate

# 초기 데이터 시드 (선택사항)
pnpm db:seed
```

### 개발 서버 실행

```bash
# 개발 모드로 실행
pnpm dev

# 빌드
pnpm build

# 테스트 실행
pnpm test

# 통합 테스트
pnpm test:integration
```

### API 엔드포인트

서버가 실행되면 다음 엔드포인트에서 API를 사용할 수 있습니다:

- Health Check: `GET http://localhost:3000/health`
- Organizations: `GET/POST http://localhost:3000/organizations`
- Teams: `GET/POST http://localhost:3000/teams`
- Tasks: `GET/POST http://localhost:3000/tasks`

## 기술 스택

### Backend

| 기술           | 용도                             |
| -------------- | -------------------------------- |
| **NestJS**     | 서버 프레임워크                  |
| **TypeORM**    | ORM 및 데이터베이스 마이그레이션 |
| **PostgreSQL** | 메인 데이터베이스                |
| **Redis**      | 캐싱 및 실시간 이벤트            |

### AI Integration

| 기술              | 용도                          |
| ----------------- | ----------------------------- |
| **Claude Code**   | Brain Provider (AI 실행 엔진) |
| **Anthropic API** | LLM 기반 태스크 분석          |

### Infrastructure

| 기술          | 용도                 |
| ------------- | -------------------- |
| **Docker**    | 컨테이너화           |
| **Turborepo** | 모노레포 빌드 시스템 |
| **pnpm**      | 패키지 매니저        |

### Development Tools

| 기술           | 용도              |
| -------------- | ----------------- |
| **TypeScript** | 타입 안전성       |
| **ESLint**     | 코드 린팅         |
| **Prettier**   | 코드 포맷팅       |
| **Jest**       | 테스트 프레임워크 |
| **Husky**      | Git Hooks         |

## 프로젝트 구조

```
hollon-ai/
├── apps/
│   └── server/              # NestJS 백엔드 서버
│       ├── src/
│       │   ├── config/      # 설정 파일
│       │   ├── database/    # 마이그레이션, 엔티티
│       │   └── modules/     # 기능별 모듈
│       │       ├── brain-provider/   # AI 실행 엔진
│       │       ├── orchestration/    # 태스크 오케스트레이션
│       │       ├── organization/     # 조직 관리
│       │       ├── team/             # 팀 관리
│       │       ├── hollon/           # Hollon 관리
│       │       ├── task/             # 태스크 관리
│       │       └── ...
│       └── test/            # 테스트 파일
├── packages/                # 공유 패키지 (추후 확장)
├── docker/                  # Docker 설정
├── docs/                    # 문서
└── ...
```

## 문서

- [Blueprint](docs/blueprint.md) - 시스템 설계 문서
- [Phase 1 Plan](docs/phase1-plan.md) - 1단계 개발 계획
- [Phase 2 Plan](docs/phase2-plan.md) - 2단계 개발 계획
- [SSOT](docs/ssot.md) - 단일 진실 공급원 (Single Source of Truth)

## 라이선스

이 프로젝트는 [MIT 라이선스](LICENSE)를 따릅니다.
