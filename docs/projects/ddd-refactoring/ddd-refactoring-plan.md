# DDD 기반 순환 의존성 해결 계획

## 문서 정보

- **작성일**: 2025-12-12
- **작성자**: Claude Code
- **목적**: Phase 3.16 Integration Test 순환 의존성 해결
- **상태**: 계획 단계
- **예상 소요**: 5일 (1주일)

---

## 1. 배경 및 문제 상황

### 1.1 현재 문제

Phase 3.16 PR의 Integration Test에서 **순환 의존성(Circular Dependency)** 오류 발생:

```
RangeError: Maximum call stack size exceeded
at InstanceWrapper.cloneStaticInstance
at InstanceWrapper.getInstanceByContextId
```

### 1.2 순환 의존성 구조

```
OrchestrationModule → CollaborationModule → HollonModule → OrchestrationModule
                    ↓                      ↑
                MessageModule ←──────────┘
```

### 1.3 시도한 해결 방법 (모두 실패)

1. ❌ forwardRef 패턴 적용
2. ❌ ModuleRef를 이용한 지연 주입
3. ❌ 환경 변수 기반 조건부 모듈 로딩
4. ❌ MessageListenerModule 분리
5. ❌ 환경 기반 cron 비활성화

**실패 원인**: 순환 의존성이 여러 곳에 중복되어 존재하며, 근본적인 아키텍처 문제임

---

## 2. DDD 솔루션 개요

### 2.1 핵심 전략

**Domain-Driven Design (DDD)** 원칙을 적용하여 모듈 간 의존성을 근본적으로 재구성:

1. **Bounded Context 식별**: 명확한 도메인 경계 설정
2. **의존성 역전 (Dependency Inversion)**: 구체적 구현 대신 인터페이스에 의존
3. **Port/Adapter 패턴**: 도메인과 인프라 분리
4. **단방향 의존성**: 순환 의존성을 단방향으로 전환

### 2.2 목표 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                    AppModule                        │
│  (Port 구현체 연결)                                  │
└─────────────────────────────────────────────────────┘
              ↓           ↓           ↓
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │   Hollon    │ │Orchestration│ │Collaboration│
    │   Module    │ │   Module    │ │   Module    │
    │             │ │             │ │             │
    │ implements  │ │   depends   │ │ implements  │
    │  IHollon-   │ │   on Ports  │ │  ICodeReview│
    │  Service    │ │             │ │  Service    │
    └─────────────┘ └─────────────┘ └─────────────┘
         ↑                                   ↑
         └──────────── no direct ───────────┘
                     dependency!
```

### 2.3 기대 효과

- ✅ 순환 의존성 완전 제거
- ✅ 모듈 독립성 및 테스트 용이성 향상
- ✅ 코드 가독성 및 유지보수성 개선
- ✅ 향후 마이크로서비스 전환 용이

---

## 3. Bounded Context 식별

### 3.1 Hollon Management Context (Hollon 관리)

**책임**:

- Hollon 엔티티 생명주기 관리
- Hollon 상태(Status) 관리
- Hollon 조회 및 선택

**주요 엔티티**:

- Hollon

**제공하는 인터페이스**:

```typescript
interface IHollonService {
  findById(id: string): Promise<Hollon>;
  updateStatus(id: string, status: HollonStatus): Promise<Hollon>;
  assignTask(hollonId: string, taskId: string): Promise<void>;
  findByStatus(status: HollonStatus): Promise<Hollon[]>;
}

interface IHollonRepository {
  findById(id: string): Promise<Hollon | null>;
  save(hollon: Hollon): Promise<Hollon>;
  findByStatus(status: HollonStatus): Promise<Hollon[]>;
}
```

---

### 3.2 Task Orchestration Context (작업 조율)

**책임**:

- Task 실행 조율
- 리소스 할당
- Task 계획 및 분배

**주요 엔티티**:

- Task
- ExecutionPlan

**의존하는 Port**:

```typescript
interface IHollonManagementPort {
  assignTaskToHollon(hollonId: string, taskId: string): Promise<void>;
  updateHollonStatus(hollonId: string, status: HollonStatus): Promise<void>;
  findAvailableHollon(criteria: HollonCriteria): Promise<Hollon | null>;
}

interface ICodeReviewPort {
  createPullRequest(taskId: string, data: PRData): Promise<PullRequest>;
  requestReview(prId: string, reviewerId: string): Promise<void>;
  findPullRequest(prId: string): Promise<PullRequest | null>;
}

interface IMessagingPort {
  sendNotification(to: string, message: NotificationData): Promise<void>;
  sendReviewRequest(reviewerId: string, prId: string): Promise<void>;
}
```

---

### 3.3 Collaboration Context (협업)

**책임**:

- 코드 리뷰 관리
- Pull Request 생성 및 추적
- 리뷰 품질 평가

**주요 엔티티**:

- TaskPullRequest
- ReviewComment
- ReviewQuality

**제공하는 인터페이스**:

```typescript
interface ICodeReviewService {
  createPR(taskId: string, data: PRData): Promise<PullRequest>;
  requestReview(prId: string, reviewerId: string): Promise<void>;
  findPullRequest(prId: string): Promise<PullRequest | null>;
  performAutomatedReview(prId: string, reviewerId: string): Promise<void>;
}
```

---

### 3.4 Communication Context (통신)

**책임**:

- 메시지 전송 및 수신
- 알림 관리
- 메시지 리스너 (Cron 기반)

**주요 엔티티**:

- Message
- Conversation

**제공하는 인터페이스**:

```typescript
interface IMessageService {
  send(message: MessageData): Promise<Message>;
  findById(id: string): Promise<Message | null>;
  markAsRead(id: string): Promise<void>;
  getInbox(userId: string, options: InboxOptions): Promise<Message[]>;
}
```

---

## 4. 단계별 실행 계획

### Phase 1: Domain Layer 분리 (1일)

#### 목표

각 컨텍스트의 도메인 로직을 인프라에서 분리

#### 디렉토리 구조

```
src/modules/
├── hollon/
│   ├── domain/                    # ✨ 새로 생성
│   │   ├── hollon.entity.ts
│   │   ├── hollon.repository.interface.ts
│   │   └── hollon-service.interface.ts
│   ├── application/               # 기존 service 이동
│   │   └── hollon.service.ts
│   └── infrastructure/            # 기존 module, controller
│       ├── hollon.module.ts
│       └── hollon.controller.ts
│
├── orchestration/
│   ├── domain/                    # ✨ 새로 생성
│   │   ├── ports/                 # Port 인터페이스
│   │   │   ├── code-review.port.ts
│   │   │   ├── hollon-management.port.ts
│   │   │   └── messaging.port.ts
│   │   └── services/
│   │       └── task-execution.domain-service.ts
│   ├── application/
│   │   └── task-execution.service.ts
│   └── infrastructure/
│       ├── adapters/              # ✨ 새로 생성
│       │   ├── code-review.adapter.ts
│       │   ├── hollon-management.adapter.ts
│       │   └── messaging.adapter.ts
│       └── orchestration.module.ts
│
├── collaboration/
│   ├── domain/                    # ✨ 새로 생성
│   │   └── code-review-service.interface.ts
│   ├── services/
│   │   └── code-review.service.ts
│   └── collaboration.module.ts
│
└── message/
    ├── domain/                    # ✨ 새로 생성
    │   └── message-service.interface.ts
    ├── message.service.ts
    └── message.module.ts
```

#### 작업 항목

**1. Hollon Context - Domain 인터페이스**

```typescript
// src/modules/hollon/domain/hollon-service.interface.ts
export interface IHollonService {
  findById(id: string): Promise<Hollon>;
  updateStatus(id: string, status: HollonStatus): Promise<Hollon>;
  assignTask(hollonId: string, taskId: string): Promise<void>;
  findByStatus(status: HollonStatus): Promise<Hollon[]>;
}
```

**2. Orchestration Context - Port 정의**

```typescript
// src/modules/orchestration/domain/ports/hollon-management.port.ts
export interface IHollonManagementPort {
  assignTaskToHollon(hollonId: string, taskId: string): Promise<void>;
  updateHollonStatus(hollonId: string, status: HollonStatus): Promise<void>;
  findAvailableHollon(criteria: HollonCriteria): Promise<Hollon | null>;
}
```

**3. Port 명명 규칙**

- 파일명: `{domain}.port.ts`
- 인터페이스명: `I{Domain}Port`
- 메서드명: 동사 시작, 명확한 의도 표현

#### 검증 기준

- [ ] 모든 인터페이스가 순수 TypeScript (NestJS 의존성 없음)
- [ ] 도메인 로직이 인프라와 분리됨
- [ ] 각 인터페이스가 단일 책임 원칙 준수
- [ ] 빌드 성공

---

### Phase 2: Adapter 구현 (1일)

#### 목표

Port 인터페이스의 구현체(Adapter) 생성

#### Adapter 패턴 설명

```
┌─────────────────────┐
│ OrchestrationModule │
│   (Consumer)        │
└──────────┬──────────┘
           │ depends on
           ↓
     ┌─────────────┐
     │   IPort     │ ← Interface
     │ (Contract)  │
     └─────────────┘
           ↑ implements
           │
     ┌─────────────┐
     │   Adapter   │ ← Implementation
     │             │
     └──────┬──────┘
            │ uses
            ↓
     ┌─────────────┐
     │   Service   │ ← Actual Service
     └─────────────┘
```

#### 작업 항목

**1. HollonManagementAdapter**

```typescript
// src/modules/orchestration/infrastructure/adapters/hollon-management.adapter.ts
@Injectable()
export class HollonManagementAdapter implements IHollonManagementPort {
  constructor(
    @Inject('IHollonService')
    private readonly hollonService: IHollonService,
  ) {}

  async assignTaskToHollon(hollonId: string, taskId: string): Promise<void> {
    return this.hollonService.assignTask(hollonId, taskId);
  }

  async updateHollonStatus(
    hollonId: string,
    status: HollonStatus,
  ): Promise<void> {
    await this.hollonService.updateStatus(hollonId, status);
  }

  async findAvailableHollon(criteria: HollonCriteria): Promise<Hollon | null> {
    // Adapter에서 선택 로직 처리
    const hollons = await this.hollonService.findByStatus(HollonStatus.IDLE);
    return this.selectBestHollon(hollons, criteria);
  }

  private selectBestHollon(
    hollons: Hollon[],
    criteria: HollonCriteria,
  ): Hollon | null {
    // 복잡한 선택 로직
    if (hollons.length === 0) return null;

    // criteria에 따라 최적 Hollon 선택
    return hollons.reduce((best, current) => {
      const bestScore = this.scoreHollon(best, criteria);
      const currentScore = this.scoreHollon(current, criteria);
      return currentScore > bestScore ? current : best;
    });
  }

  private scoreHollon(hollon: Hollon, criteria: HollonCriteria): number {
    // 점수 계산 로직
    let score = 0;
    if (hollon.role?.name === criteria.role) score += 10;
    // ... more scoring logic
    return score;
  }
}
```

**2. CodeReviewAdapter**

```typescript
// src/modules/orchestration/infrastructure/adapters/code-review.adapter.ts
@Injectable()
export class CodeReviewAdapter implements ICodeReviewPort {
  constructor(
    @Inject('ICodeReviewService')
    private readonly codeReviewService: ICodeReviewService,
  ) {}

  async createPullRequest(taskId: string, data: PRData): Promise<PullRequest> {
    return this.codeReviewService.createPR(taskId, data);
  }

  async requestReview(prId: string, reviewerId: string): Promise<void> {
    return this.codeReviewService.requestReview(prId, reviewerId);
  }

  async findPullRequest(prId: string): Promise<PullRequest | null> {
    return this.codeReviewService.findPullRequest(prId);
  }
}
```

**3. MessagingAdapter**

```typescript
// src/modules/orchestration/infrastructure/adapters/messaging.adapter.ts
@Injectable()
export class MessagingAdapter implements IMessagingPort {
  constructor(
    @Inject('IMessageService')
    private readonly messageService: IMessageService,
  ) {}

  async sendNotification(to: string, message: NotificationData): Promise<void> {
    return this.messageService.send({
      to,
      type: MessageType.NOTIFICATION,
      content: message,
    });
  }

  async sendReviewRequest(reviewerId: string, prId: string): Promise<void> {
    return this.messageService.send({
      to: reviewerId,
      type: MessageType.REVIEW_REQUEST,
      metadata: { prId },
    });
  }
}
```

#### Adapter 설계 원칙

1. **단순한 변환만 수행**: 복잡한 비즈니스 로직은 Domain Service에
2. **Port 인터페이스 1:1 구현**: 하나의 Adapter는 하나의 Port 구현
3. **에러 변환**: 외부 에러를 도메인 에러로 변환
4. **로깅**: 모든 Adapter 호출 로깅 (디버깅 용이)

#### 검증 기준

- [ ] 모든 Adapter가 단일 Port 구현
- [ ] Adapter가 도메인 로직 포함하지 않음
- [ ] 에러 핸들링 적절히 구현
- [ ] 빌드 성공

---

### Phase 3: Module 의존성 재구성 (1.5일)

#### 목표

모듈 간 직접 의존을 Port/Adapter 패턴으로 전환

#### 작업 항목

**1. OrchestrationModule 리팩토링**

**Before**:

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Document]),
    BrainProviderModule,
    CollaborationModule, // ❌ 직접 의존
    forwardRef(() => HollonModule), // ❌ 순환 의존
    MessageModule, // ❌ 직접 의존
  ],
  providers: [TaskExecutionService, HollonOrchestratorService],
})
export class OrchestrationModule {}
```

**After**:

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Document, Organization]),
    BrainProviderModule,
    // ✅ 다른 feature 모듈 import 제거
  ],
  providers: [
    // Domain Services
    TaskExecutionDomainService,

    // Application Services
    TaskExecutionService,
    HollonOrchestratorService,

    // Adapters (Port 구현체)
    {
      provide: 'ICodeReviewPort',
      useClass: CodeReviewAdapter,
    },
    {
      provide: 'IHollonManagementPort',
      useClass: HollonManagementAdapter,
    },
    {
      provide: 'IMessagingPort',
      useClass: MessagingAdapter,
    },
  ],
  exports: [TaskExecutionService, HollonOrchestratorService],
})
export class OrchestrationModule {}
```

**2. AppModule에서 Port 구현체 연결**

```typescript
// src/app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      /* ... */
    }),
    ScheduleModule.forRoot(),

    // Feature modules
    HollonModule,
    OrchestrationModule,
    CollaborationModule,
    MessageModule,
    TaskModule,
    // ... other modules
  ],
  providers: [
    // ✨ Port 구현체 연결 (Global scope)

    // Hollon Context 구현체
    {
      provide: 'IHollonService',
      useExisting: HollonService,
    },

    // Collaboration Context 구현체
    {
      provide: 'ICodeReviewService',
      useExisting: CodeReviewService,
    },

    // Message Context 구현체
    {
      provide: 'IMessageService',
      useExisting: MessageService,
    },
  ],
})
export class AppModule {}
```

**3. TaskExecutionService 리팩토링**

**Before**:

```typescript
@Injectable()
export class TaskExecutionService {
  constructor(
    private readonly codeReviewService: CodeReviewService,  // ❌ 구체 클래스
    private readonly hollonService: HollonService,          // ❌ 구체 클래스
  ) {}

  async executeTask(taskId: string): Promise<void> {
    // ...
    await this.codeReviewService.createPR(...);  // ❌ 직접 호출
    await this.hollonService.updateStatus(...);  // ❌ 직접 호출
  }
}
```

**After**:

```typescript
@Injectable()
export class TaskExecutionService {
  constructor(
    @Inject('ICodeReviewPort')
    private readonly codeReviewPort: ICodeReviewPort, // ✅ Port 인터페이스

    @Inject('IHollonManagementPort')
    private readonly hollonPort: IHollonManagementPort, // ✅ Port 인터페이스

    @Inject('IMessagingPort')
    private readonly messagingPort: IMessagingPort, // ✅ Port 인터페이스

    private readonly taskExecutionDomain: TaskExecutionDomainService,
  ) {}

  async executeTask(taskId: string): Promise<void> {
    // 1. Task 실행 (도메인 로직)
    const result = await this.taskExecutionDomain.execute(taskId);

    // 2. PR 생성 (Port 사용)
    const pr = await this.codeReviewPort.createPullRequest(taskId, {
      title: result.title,
      description: result.description,
      branch: result.branch,
    });

    // 3. 리뷰어 찾기 및 리뷰 요청 (Port 사용)
    const reviewer = await this.hollonPort.findAvailableHollon({
      role: 'REVIEWER',
      skills: result.requiredSkills,
    });

    if (reviewer) {
      await this.codeReviewPort.requestReview(pr.id, reviewer.id);
      await this.messagingPort.sendReviewRequest(reviewer.id, pr.id);
    }

    // 4. Hollon 상태 업데이트 (Port 사용)
    await this.hollonPort.updateHollonStatus(
      result.hollonId,
      HollonStatus.WAITING_REVIEW,
    );
  }
}
```

#### 의존성 변화 비교

| Before                       | After             |
| ---------------------------- | ----------------- |
| 모듈이 다른 모듈 직접 import | 모듈이 독립적     |
| 구체 클래스에 의존           | 인터페이스에 의존 |
| 순환 의존성 존재             | 단방향 의존성     |
| 테스트 시 실제 서비스 필요   | Mock Port만 필요  |

#### 검증 기준

- [ ] OrchestrationModule이 다른 feature 모듈을 import하지 않음
- [ ] 모든 서비스가 Port 인터페이스에만 의존
- [ ] AppModule에서 모든 Port 구현체 연결
- [ ] 빌드 성공

---

### Phase 4: MessageListener 리팩토링 (0.5일)

#### 목표

MessageListener의 직접 의존성 제거

#### 현재 문제

```typescript
// MessageListener가 CollaborationModule 서비스에 직접 의존
constructor(
  private readonly codeReviewService: CodeReviewService,  // ❌
  private readonly reviewerHollonService: ReviewerHollonService,  // ❌
) {}
```

#### 해결 방법

**1. MessageListener를 Port 사용자로 변경**

```typescript
// src/modules/message/listeners/message.listener.ts
@Injectable()
export class MessageListener {
  private readonly logger = new Logger(MessageListener.name);

  constructor(
    private readonly messageService: MessageService,

    @Inject('ICodeReviewPort')
    private readonly codeReviewPort: ICodeReviewPort, // ✅ Port 사용

    @Inject('IHollonManagementPort')
    private readonly hollonPort: IHollonManagementPort, // ✅ Port 사용

    private readonly resourcePlanner: ResourcePlannerService,
    private readonly taskService: TaskService,

    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processUnreadMessages(): Promise<void> {
    try {
      const unreadMessages = await this.messageService.findAll({
        isRead: false,
        limit: 100,
      });

      for (const message of unreadMessages) {
        await this.handleMessage(message);
        await this.messageService.markAsRead(message.id);
      }
    } catch (error) {
      this.logger.error('Error processing unread messages', error);
    }
  }

  private async handleMessage(message: any): Promise<void> {
    switch (message.messageType) {
      case MessageType.REVIEW_REQUEST:
        await this.handleReviewRequest(message);
        break;
      // ... other cases
    }
  }

  private async handleReviewRequest(message: any): Promise<void> {
    const { prId, taskId } = message.metadata || {};

    if (!prId) {
      this.logger.warn(`Missing prId in metadata`);
      return;
    }

    const reviewerHollonId = message.toId;

    // ✅ Port를 통한 PR 조회
    const pr = await this.codeReviewPort.findPullRequest(prId);

    if (!pr) {
      this.logger.warn(`PR ${prId} not found`);
      return;
    }

    // ✅ Port를 통한 리뷰 요청
    await this.codeReviewPort.requestReview(prId, reviewerHollonId);

    // ✅ Port를 통한 Hollon 상태 업데이트
    await this.hollonPort.updateHollonStatus(
      reviewerHollonId,
      HollonStatus.REVIEWING,
    );

    this.logger.log(`Review request processed for PR ${prId}`);
  }
}
```

**2. MessageModule 의존성 제거**

```typescript
// src/modules/message/message.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Message,
      Conversation,
      ConversationHistory,
      Hollon,
    ]),
    TaskModule, // Task 정보 조회용으로만 유지
    // ❌ 제거: forwardRef(() => CollaborationModule)
  ],
  providers: [MessageService, MessageListener],
  exports: [MessageService],
})
export class MessageModule {}
```

#### 검증 기준

- [ ] MessageModule이 CollaborationModule import하지 않음
- [ ] MessageListener가 Port를 통해서만 다른 컨텍스트 접근
- [ ] Cron job이 정상 동작
- [ ] Integration test 통과

---

### Phase 5: CollaborationModule 인터페이스 구현 (0.5일)

#### 목표

CollaborationModule의 서비스가 인터페이스 구현

#### 작업 항목

**1. CodeReviewService 인터페이스 구현**

```typescript
// src/modules/collaboration/domain/code-review-service.interface.ts
export interface ICodeReviewService {
  createPR(taskId: string, data: PRData): Promise<PullRequest>;
  requestReview(prId: string, reviewerId: string): Promise<void>;
  findPullRequest(prId: string): Promise<PullRequest | null>;
  performAutomatedReview(prId: string, reviewerId: string): Promise<void>;
}
```

```typescript
// src/modules/collaboration/services/code-review.service.ts
@Injectable()
export class CodeReviewService implements ICodeReviewService {
  // 기존 구현 유지, 인터페이스만 추가

  async createPR(taskId: string, data: PRData): Promise<PullRequest> {
    // 기존 로직
  }

  async requestReview(prId: string, reviewerId: string): Promise<void> {
    // 기존 로직
  }

  async findPullRequest(prId: string): Promise<PullRequest | null> {
    // 기존 로직
  }

  async performAutomatedReview(
    prId: string,
    reviewerId: string,
  ): Promise<void> {
    // 기존 로직
  }
}
```

**2. CollaborationModule에서 export**

```typescript
// src/modules/collaboration/collaboration.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CollaborationSession,
      TaskPullRequest,
      Hollon,
      Task,
      Role,
    ]),
    forwardRef(() => MessageModule), // 메시지 전송용으로 유지
    // ❌ 제거: forwardRef(() => HollonModule) - Port 사용으로 대체
    BrainProviderModule,
  ],
  providers: [
    CollaborationService,
    CodeReviewService,
    ReviewerHollonService,
    PRDiffCacheService,
    ReviewQualityService,

    // ✨ 인터페이스 구현체로 등록
    {
      provide: 'ICodeReviewService',
      useExisting: CodeReviewService,
    },
  ],
  exports: [
    CollaborationService,
    CodeReviewService,
    ReviewerHollonService,
    PRDiffCacheService,
    ReviewQualityService,
    'ICodeReviewService', // ✨ 인터페이스도 export
  ],
})
export class CollaborationModule {}
```

#### 검증 기준

- [ ] CodeReviewService가 인터페이스 구현
- [ ] 타입 안정성 유지
- [ ] HollonModule 의존성 제거 가능
- [ ] 빌드 성공

---

### Phase 6: 순환 의존성 검증 및 정리 (1일)

#### 목표

모든 순환 의존성 제거 확인 및 최종 검증

#### 작업 항목

**1. 순환 의존성 체크**

```bash
# madge 설치 (필요시)
npm install -g madge

# 순환 의존성 검사
npx madge --circular --extensions ts src/

# 예상 출력: No circular dependencies found!

# 의존성 그래프 생성
npx madge --image docs/architecture/deps-graph.svg --extensions ts src/
```

**2. 모든 테스트 실행**

```bash
# Unit tests
pnpm test
# 예상: PASS (428 tests)

# Integration tests
pnpm test:integration
# 예상: PASS (순환 의존성 해결로 정상 실행)

# E2E tests
pnpm test:e2e
# 예상: PASS
```

**3. 불필요한 forwardRef 제거**

```typescript
// OrchestrationModule
- forwardRef(() => CollaborationModule)  // ✅ 제거
- forwardRef(() => HollonModule)         // ✅ 제거 (Port 사용)

// CollaborationModule
- forwardRef(() => HollonModule)         // ✅ 제거 (Port 사용)

// MessageModule
- forwardRef(() => CollaborationModule)  // ✅ 제거 (Port 사용)

// 유지 필요한 forwardRef
- OrchestrationModule의 forwardRef(() => GoalModule)  // ✅ 유지
- HollonModule의 forwardRef(() => OrchestrationModule)  // ✅ 유지
- HollonModule의 forwardRef(() => TeamModule)  // ✅ 유지
```

**4. 코드 정리**

- 사용하지 않는 import 제거
- 주석 정리 및 업데이트
- 코드 포맷팅

**5. 문서화**

```markdown
# docs/architecture/ddd-implementation.md

## Port/Adapter 목록

### Orchestration Context가 사용하는 Ports

#### IHollonManagementPort

- 구현체: HollonManagementAdapter
- 실제 서비스: HollonService
- 위치: src/modules/orchestration/infrastructure/adapters/

#### ICodeReviewPort

- 구현체: CodeReviewAdapter
- 실제 서비스: CodeReviewService
- 위치: src/modules/orchestration/infrastructure/adapters/

#### IMessagingPort

- 구현체: MessagingAdapter
- 실제 서비스: MessageService
- 위치: src/modules/orchestration/infrastructure/adapters/

## 의존성 다이어그램

[Graph image]

## 테스트 가이드

...
```

**6. 성능 측정**

```typescript
// 빌드 시간 비교
Before: X초
After: Y초
Change: Z%

// 테스트 실행 시간
Unit tests: X초 → Y초
Integration tests: X초 → Y초
E2E tests: X초 → Y초
```

#### 검증 기준

- [ ] `npx madge --circular` 결과 0개
- [ ] 모든 unit test 통과 (428개)
- [ ] 모든 integration test 통과
- [ ] 모든 e2e test 통과
- [ ] 빌드 시간 증가 < 10%
- [ ] 코드 리뷰 완료
- [ ] 문서 작성 완료

---

## 5. 예상 일정 및 리소스

### 5.1 세부 일정

| Phase    | 작업 내용                      | 소요 시간 | 담당자           | 의존성    |
| -------- | ------------------------------ | --------- | ---------------- | --------- |
| 1        | Domain Layer 분리              | 1일       | Backend Dev      | -         |
| 2        | Adapter 구현                   | 1일       | Backend Dev      | Phase 1   |
| 3        | Module 의존성 재구성           | 1.5일     | Backend Dev      | Phase 2   |
| 4        | MessageListener 리팩토링       | 0.5일     | Backend Dev      | Phase 3   |
| 5        | CollaborationModule 인터페이스 | 0.5일     | Backend Dev      | Phase 3   |
| 6        | 검증 및 정리                   | 1일       | Backend Dev + QA | Phase 4,5 |
| **합계** |                                | **5.5일** |                  |           |

### 5.2 병렬 진행 가능

```
Day 1: Phase 1
Day 2: Phase 2
Day 3-4: Phase 3
Day 5: Phase 4 + Phase 5 (병렬)
Day 6: Phase 6
```

**실제 소요 예상**: 5-6일 (약 1주일)

### 5.3 리소스 요구사항

- **Backend 개발자**: 1명 (풀타임)
- **코드 리뷰어**: 1명 (파트타임, 각 Phase 완료 시)
- **QA**: 1명 (Phase 6에서 집중 테스트)

---

## 6. 위험 요소 및 대응 방안

### 6.1 위험 요소

| 위험                           | 영향도 | 확률 | 대응 방안                                         |
| ------------------------------ | ------ | ---- | ------------------------------------------------- |
| 인터페이스 설계 오류           | 높음   | 중   | Phase 1에서 충분한 리뷰 시간 확보                 |
| AppModule provider 복잡도 증가 | 중     | 높음 | Factory pattern 또는 별도 configuration 모듈 검토 |
| 기존 기능 회귀                 | 높음   | 중   | 각 Phase마다 테스트 실행                          |
| Port 명명 혼란                 | 낮음   | 중   | 명확한 네이밍 컨벤션 문서화                       |
| 성능 오버헤드                  | 낮음   | 낮음 | 추상화 레이어는 단순 위임만 수행                  |

### 6.2 롤백 계획

```bash
# 각 Phase마다 브랜치 생성
git checkout -b phase1-domain-layer
# Phase 1 작업 완료 후
git commit -m "Phase 1: Domain layer separation"

# Phase 2 시작
git checkout -b phase2-adapters
# ...

# 문제 발생 시
git checkout phase1-domain-layer  # 이전 Phase로 롤백
```

---

## 7. 성공 기준

### 7.1 기술적 기준 (필수)

- ✅ **순환 의존성 0개**: `npx madge --circular` 결과 깨끗
- ✅ **모든 테스트 통과**: Unit, Integration, E2E 모두 PASS
- ✅ **빌드 성공**: 에러 및 경고 없이 빌드 완료
- ✅ **성능 유지**: 빌드 시간 증가 < 10%, 테스트 실행 시간 증가 < 15%

### 7.2 코드 품질 기준 (필수)

- ✅ **모듈 응집도 증가**: 각 모듈이 명확한 책임 보유
- ✅ **모듈 결합도 감소**: 모듈 간 직접 의존 최소화
- ✅ **타입 안정성**: 모든 Port/Adapter에 명확한 타입 정의
- ✅ **코드 리뷰 승인**: 시니어 개발자의 승인

### 7.3 문서화 기준 (필수)

- ✅ **아키텍처 다이어그램**: 새로운 구조 시각화
- ✅ **Port/Adapter 목록**: 모든 인터페이스 및 구현체 문서화
- ✅ **마이그레이션 가이드**: 향후 개발자를 위한 가이드
- ✅ **테스트 가이드**: Port mock 방법 설명

---

## 8. 향후 개선 방향

### 8.1 단기 개선 (1-2개월)

1. **Factory Pattern 도입**
   - AppModule의 provider 복잡도 감소
   - Port 연결 로직을 별도 Factory로 분리

2. **Domain Event 추가**
   - 필요한 경우 경량 이벤트 시스템 도입
   - 단, Port/Adapter 패턴을 먼저 유지

3. **통합 테스트 강화**
   - Port/Adapter별 통합 테스트 추가
   - Contract Testing 도입 검토

### 8.2 중기 개선 (3-6개월)

1. **CQRS 패턴 적용**
   - Read/Write 분리 검토
   - 복잡한 조회 로직 최적화

2. **Saga 패턴**
   - 분산 트랜잭션 처리
   - 보상 트랜잭션 구현

3. **API Gateway 패턴**
   - 외부 요청 라우팅
   - 인증/인가 중앙화

### 8.3 장기 개선 (6개월+)

1. **마이크로서비스 전환**
   - Bounded Context별로 독립 서비스화
   - 서비스 간 통신 (REST, gRPC)

2. **Event Sourcing**
   - 상태 변경 이벤트로 저장
   - 시간 여행 디버깅

3. **클라우드 네이티브**
   - Kubernetes 배포
   - 서비스 메시 도입

---

## 9. 참고 자료

### 9.1 DDD 리소스

- **도서**: "Domain-Driven Design" by Eric Evans
- **도서**: "Implementing Domain-Driven Design" by Vaughn Vernon
- **아티클**: [DDD, Hexagonal, Onion, Clean, CQRS, … How I put it all together](https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/)

### 9.2 NestJS Patterns

- [NestJS - Fundamentals: Custom providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [NestJS - Fundamentals: Circular dependency](https://docs.nestjs.com/fundamentals/circular-dependency)

### 9.3 내부 문서

- `docs/phase3-completion-analysis.md`: Phase 3 완료 분석
- `docs/architecture/`: 기존 아키텍처 문서

---

## 10. 승인 및 시작

### 10.1 검토 체크리스트

- [ ] 계획 내용 검토 완료
- [ ] 일정 및 리소스 확인
- [ ] 위험 요소 이해 및 동의
- [ ] 롤백 계획 확인

### 10.2 승인

- **작성자**: Claude Code
- **검토자**: **\*\***\_**\*\***
- **승인자**: **\*\***\_**\*\***
- **승인일**: **\*\***\_**\*\***

### 10.3 시작

- **시작일**: **\*\***\_**\*\***
- **예상 완료일**: **\*\***\_**\*\***
- **실제 완료일**: **\*\***\_**\*\***

---

## 변경 이력

| 날짜       | 버전 | 변경 내용 | 작성자      |
| ---------- | ---- | --------- | ----------- |
| 2025-12-12 | 1.0  | 초안 작성 | Claude Code |

---

## 부록 A: 용어 정의

- **Bounded Context**: DDD에서 특정 도메인 모델이 적용되는 명확한 경계
- **Port**: 도메인이 외부와 상호작용하기 위한 인터페이스
- **Adapter**: Port 인터페이스의 구체적 구현체
- **Domain Service**: 엔티티나 값 객체로 표현하기 어려운 도메인 로직
- **Application Service**: 유즈케이스 구현, 도메인 서비스를 조율
- **Infrastructure**: 기술적 구현 (DB, HTTP, 메시징 등)

---

## 부록 B: 코드 예시 - Port Mock (테스트용)

```typescript
// test/mocks/code-review.port.mock.ts
export const createMockCodeReviewPort = (): ICodeReviewPort => ({
  createPullRequest: jest.fn().mockResolvedValue({
    id: 'pr-123',
    title: 'Test PR',
    status: 'OPEN',
  }),

  requestReview: jest.fn().mockResolvedValue(undefined),

  findPullRequest: jest.fn().mockImplementation((prId: string) => {
    if (prId === 'pr-123') {
      return Promise.resolve({
        id: 'pr-123',
        title: 'Test PR',
        status: 'OPEN',
      });
    }
    return Promise.resolve(null);
  }),
});

// 사용 예시
describe('TaskExecutionService', () => {
  let service: TaskExecutionService;
  let mockCodeReviewPort: ICodeReviewPort;

  beforeEach(() => {
    mockCodeReviewPort = createMockCodeReviewPort();

    service = new TaskExecutionService(
      mockCodeReviewPort,
      // ... other mocks
    );
  });

  it('should create PR after task execution', async () => {
    await service.executeTask('task-1');

    expect(mockCodeReviewPort.createPullRequest).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        title: expect.any(String),
        description: expect.any(String),
      }),
    );
  });
});
```

---

END OF DOCUMENT
