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

### 지능형 검색 및 지식 관리

- **pgvector 기반 벡터 유사도 검색**: PostgreSQL의 pgvector 확장을 통한 고성능 시맨틱 검색
- **RAG (Retrieval-Augmented Generation)**: 문서 임베딩과 벡터 검색을 활용한 지식 기반 AI 응답
- **지식 추출 및 저장**: AI가 수행한 태스크와 학습 내용을 벡터 형태로 저장하여 재사용

## pgvector 통합

Hollon-AI는 PostgreSQL의 pgvector 확장을 사용하여 벡터 유사도 검색 기능을 제공합니다. 이를 통해 시맨틱 검색, 지식 검색, AI 기반 추천 등의 고급 기능을 구현할 수 있습니다.

### 개요

pgvector는 PostgreSQL용 오픈소스 벡터 유사도 검색 확장으로, AI 임베딩 벡터를 저장하고 효율적으로 검색할 수 있게 해줍니다.

**주요 이점**:

- **통합된 데이터베이스**: 관계형 데이터와 벡터 데이터를 하나의 데이터베이스에서 관리
- **고성능 검색**: HNSW 및 IVFFlat 인덱스를 통한 빠른 유사도 검색
- **확장 가능**: 수백만 개의 벡터를 효율적으로 처리
- **오픈소스**: MIT 라이선스로 무료 사용 가능

### 주요 기능

#### 1. 벡터 유사도 검색

의미 기반 검색을 통해 키워드 매칭을 넘어선 지능형 검색을 제공합니다:

- **시맨틱 검색**: 의미가 유사한 문서 및 콘텐츠 검색
- **관계 발견**: 지식 그래프에서 관련 엔티티 및 개념 식별
- **콘텐츠 중복 제거**: 벡터 유사도를 사용한 중복 콘텐츠 감지

#### 2. 임베딩 저장

다양한 차원의 AI 임베딩을 효율적으로 저장:

- **고차원 벡터 지원**: 최대 2,000차원까지 지원
- **다양한 임베딩 모델**: OpenAI, Cohere, 커스텀 모델 등
- **메타데이터 통합**: 벡터와 관계형 데이터를 함께 저장

#### 3. RAG (Retrieval-Augmented Generation)

벡터 검색을 활용한 지식 기반 AI 응답 생성:

- **문맥 검색**: 관련 문서 및 지식을 벡터 검색으로 찾기
- **향상된 응답**: 검색된 컨텍스트를 바탕으로 정확한 AI 응답 생성
- **지식 재사용**: 과거 태스크 및 학습 내용을 재활용

### 사용 예시

#### 문서 검색 예시

```typescript
// Document 엔티티에서 유사한 문서 검색
const searchEmbedding = await generateEmbedding(query);

const similarDocuments = await dataSource
  .getRepository(Document)
  .createQueryBuilder('doc')
  .select(['doc.id', 'doc.title', 'doc.content'])
  .addSelect(`doc.embedding <=> :embedding`, 'distance')
  .setParameter('embedding', JSON.stringify(searchEmbedding))
  .orderBy('distance', 'ASC')
  .limit(10)
  .getRawMany();
```

#### 지식 그래프 검색 예시

```typescript
// Knowledge Graph에서 관련 노드 찾기
const relatedNodes = await entityManager.query(
  `
  SELECT id, name, type, embedding <-> $1::vector as distance
  FROM graph_nodes
  WHERE type = $2
  ORDER BY distance
  LIMIT 5
  `,
  [embedding, 'concept']
);
```

### 전제 조건

pgvector를 사용하기 위한 시스템 요구사항:

- **PostgreSQL**: 16 이상 (현재 프로젝트는 PostgreSQL 16 사용)
- **pgvector 확장**: 0.5.0 이상 (Docker 이미지에 포함)
- **Docker**: 개발 환경에서 `pgvector/pgvector:pg16` 이미지 사용
- **충분한 메모리**: 벡터 인덱스 빌드를 위한 적절한 RAM (최소 2GB 권장)

### 설정

프로젝트는 이미 pgvector가 설정되어 있습니다:

1. **Docker 이미지**: `pgvector/pgvector:pg16` 사용 (확장 프리인스톨)
2. **데이터베이스 마이그레이션**: InitialSchema 마이그레이션에서 pgvector 확장 활성화
3. **엔티티 설정**: Document 및 Knowledge Graph 엔티티에 vector 컬럼 포함

개발 환경에서 시작하기:

```bash
# Docker 서비스 시작 (PostgreSQL with pgvector)
pnpm docker:up

# 데이터베이스 마이그레이션 실행
pnpm db:migrate
```

### 관련 문서

pgvector 통합에 대한 자세한 내용:

- [pgvector 마이그레이션 가이드](docs/migrations/pgvector-migration.md) - 설정 및 스키마 변경 상세
- [pgvector 모범 사례](docs/pgvector-best-practices.md) - 최적화 및 인덱싱 전략
- [pgvector TypeORM 통합](docs/pgvector-typeorm-integration.md) - TypeORM 패턴 및 사용법
- [pgvector 공식 문서](https://github.com/pgvector/pgvector) - 확장 기능 및 API 레퍼런스

### 성능 최적화

프로덕션 환경에서 최적의 성능을 위한 권장사항:

- **인덱스 사용**: 대량의 벡터 데이터에는 HNSW 또는 IVFFlat 인덱스 생성
- **적절한 차원**: 임베딩 모델에 맞는 벡터 차원 사용 (예: OpenAI text-embedding-ada-002는 1536차원)
- **배치 작업**: 대량의 벡터 삽입 시 배치 처리 사용
- **메모리 설정**: PostgreSQL의 `shared_buffers` 및 `work_mem` 적절히 조정

자세한 성능 튜닝 가이드는 [pgvector 모범 사례](docs/pgvector-best-practices.md)를 참조하세요.

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

| 기술           | 용도                                |
| -------------- | ----------------------------------- |
| **NestJS**     | 서버 프레임워크                     |
| **TypeORM**    | ORM 및 데이터베이스 마이그레이션    |
| **PostgreSQL** | 메인 데이터베이스                   |
| **pgvector**   | 벡터 유사도 검색 (시맨틱 검색, RAG) |
| **Redis**      | 캐싱 및 실시간 이벤트               |

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
