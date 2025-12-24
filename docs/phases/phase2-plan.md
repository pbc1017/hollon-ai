# Phase 2: 협업 시스템 - 상세 계획

> **핵심 목표**: 다수 홀론이 협업하여 프로젝트를 진행하는 메커니즘 구현

---

## 관련 문서 참조

- **핵심 개념**: [ssot.md](./ssot.md) - 비전, 원칙, 작동 방식
- **구현 명세**: [blueprint.md](./blueprint.md) - DB 스키마, TypeScript 코드, API 정의

---

## ssot.md 커버리지

Phase 1 + Phase 2 완료 시 ssot.md 달성률: **약 70%**

| ssot.md 섹션                | Phase 2 커버리지 | 비고                               |
| --------------------------- | ---------------- | ---------------------------------- |
| 1. 비전 & 핵심 개념         | ✅ 기반 전제     | 변경 없음                          |
| 2. 시스템 아키텍처          | ✅ Phase 1 완료  | -                                  |
| 3. 핵심 엔티티              | 🟡 70%           | Channel, Message 추가              |
| 4. 시스템 작동 방식         | 🟡 60%           | 4.4 협업 흐름 구현                 |
| 5. 핵심 원칙                | 🟡 50%           | 5.2 동시성 반영, RAG는 Phase 4     |
| 6. 자율 운영 정책           | 🟡 65%           | 6.2~6.7 대부분 반영                |
| 7. LLM 한계 대응            | 🔴 20%           | Phase 1 범위, FactCheck 등 Phase 4 |
| **8. 협업 및 커뮤니케이션** | **✅ 90%**       | **Phase 2 핵심 범위**              |
| 9. 기술 스택                | ✅ 100%          | WebSocket 추가                     |
| 10. 용어 정리               | ✅ 참조용        | -                                  |

**미구현 항목 (Phase 3-4 예정)**:

- Vector/Graph RAG (5.5~5.6)
- GoalDecompositionService (7)
- FactCheckService (7)
- ExternalKnowledgeService (7)

---

## 완료 기준

- [ ] 3+ 홀론이 동시에 프로젝트 진행
- [ ] 실시간 메시지 수신/발신 동작 (1:1 + Channel)
- [ ] 일일 스탠드업 리포트 자동 생성
- [ ] 팀 간 의존성 요청 및 계약(Contract) 체결
- [ ] 코드 리뷰 프로세스 완료 (PR 생성 → 리뷰 → 머지)
- [ ] 기술 부채 주간 리뷰 자동화

---

## 핵심 원칙 (ssot.md 기반)

### 동시성 모델 (Concurrency)

홀론 간 협업은 **병렬성(Parallelism)이 아닌 동시성(Concurrency)**으로 동작합니다:

```
인간 회의:     A 발언 → B 듣고 생각 → B 발언 → A 듣고 생각 → ...
홀론 협업:     A 작업 → DB 저장 → B 읽음 → B 작업 → DB 저장 → ...

차이: 지연 시간(latency)뿐, 본질은 동일한 순차적 컨텍스트 스위칭
```

LLM은 동시에 "생각"할 수 없으므로, Document-Memory 기반 비동기 협업이 실시간 논의와 **개념적으로 동일**합니다.

### 에스컬레이션 계층

협업 중 문제 발생 시 5단계 에스컬레이션을 따릅니다:

```
Level 1: 자기 해결 (재시도, 대안 탐색)
    ↓ 실패 시
Level 2: 팀 내 협업 (같은 팀 홀론에게 도움 요청)
    ↓ 해결 불가 시
Level 3: 팀 리더 판단 (우선순위 조정, 리소스 재배치)
    ↓ 권한 밖 시
Level 4: 상위 팀/조직 레벨
    ↓ 중대 사안 시
Level 5: 인간 개입 요청
```

### 팀 간 협업 (Contract)

팀 간 의존성은 **Contract(인터페이스 계약)**로 관리:

- 제공 범위, API 스펙
- 일정, 우선순위
- 변경 시 통보 의무

---

## Week 7-8: 실시간 통신

### Week 7: PostgreSQL LISTEN/NOTIFY 및 메시지 시스템

#### Day 1-2: 데이터베이스 트리거 및 메시지 엔티티

**작업 목록**:

- [ ] `messages` 테이블 마이그레이션 추가
- [ ] `conversations` 및 `conversation_history` 테이블 추가
- [ ] `channel_messages` 테이블 추가 (그룹 채널용)
- [ ] PostgreSQL NOTIFY 트리거 생성:
  - `notify_new_message()` - 메시지 전송 알림
  - `notify_holon_status_change()` - 홀론 상태 변경 알림
  - `notify_approval_request()` - 승인 요청 알림

```sql
-- 메시지 전송 알림 트리거
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'holon_message_' || NEW.to_id::text,
        json_build_object(
            'id', NEW.id,
            'from_type', NEW.from_type,
            'from_id', NEW.from_id,
            'message_type', NEW.message_type,
            'content', substring(NEW.content, 1, 200)
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Day 3-4: MessageModule 구현

```
apps/server/src/modules/message/
├── dto/
│   ├── create-message.dto.ts
│   ├── send-message.dto.ts
│   └── message-query.dto.ts
├── entities/
│   ├── message.entity.ts
│   ├── conversation.entity.ts
│   └── conversation-history.entity.ts
├── message.controller.ts
├── message.service.ts
├── message.module.ts
└── interfaces/
    └── message.interface.ts
```

**MessageService 핵심 메서드**:

```typescript
@Injectable()
export class MessageService {
  // 메시지 발송
  async send(dto: SendMessageDto): Promise<Message>;

  // 홀론 인박스 조회
  async getInbox(hollonId: string, options?: InboxOptions): Promise<Message[]>;

  // 메시지 읽음 처리
  async markAsRead(messageId: string): Promise<void>;

  // 대화 기록 조회
  async getConversationHistory(
    participant1: Participant,
    participant2: Participant,
    limit?: number,
  ): Promise<Message[]>;
}
```

**Message Types (blueprint.md 기반)**:

```typescript
type MessageType =
  | 'task_assignment' // 태스크 할당
  | 'task_update' // 태스크 상태 업데이트
  | 'task_completion' // 태스크 완료
  | 'question' // 질문
  | 'response' // 응답
  | 'delegation_request' // 위임 요청
  | 'delegation_approval' // 위임 승인
  | 'collaboration_request' // 협업 요청
  | 'review_request' // 코드 리뷰 요청
  | 'conflict_notification' // 충돌 알림
  | 'general'; // 일반 메시지
```

**작업 목록**:

- [ ] Message 엔티티 정의 (from_type, to_type, message_type 포함)
- [ ] Conversation 엔티티 정의
- [ ] MessageService 구현
- [ ] MessageController 구현 (POST /messages, GET /messages/inbox)
- [ ] requires_response 필드 활용한 응답 대기 로직
- [ ] 단위 테스트 작성

#### Day 5: PostgreSQL LISTEN 리스너 서비스

```typescript
// postgres-listener.service.ts
@Injectable()
export class PostgresListenerService implements OnModuleInit, OnModuleDestroy {
  private client: pg.Client;
  private subscriptions = new Map<string, Set<(payload: any) => void>>();

  async onModuleInit(): Promise<void> {
    this.client = new pg.Client(/* config */);
    await this.client.connect();

    this.client.on('notification', (msg) => {
      const handlers = this.subscriptions.get(msg.channel);
      if (handlers) {
        const payload = JSON.parse(msg.payload || '{}');
        handlers.forEach((handler) => handler(payload));
      }
    });
  }

  async subscribe(
    channel: string,
    handler: (payload: any) => void,
  ): Promise<void> {
    if (!this.subscriptions.has(channel)) {
      await this.client.query(`LISTEN ${channel}`);
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(handler);
  }

  async unsubscribe(
    channel: string,
    handler: (payload: any) => void,
  ): Promise<void> {
    const handlers = this.subscriptions.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        await this.client.query(`UNLISTEN ${channel}`);
        this.subscriptions.delete(channel);
      }
    }
  }
}
```

**작업 목록**:

- [ ] PostgresListenerService 구현
- [ ] 채널별 구독/해제 로직
- [ ] 연결 재시도 및 에러 핸들링
- [ ] 통합 테스트 (NOTIFY → 핸들러 호출)

---

### Week 8: WebSocket Gateway

#### Day 1-2: NestJS WebSocket Gateway 설정

```
apps/server/src/modules/realtime/
├── realtime.module.ts
├── realtime.gateway.ts
├── interfaces/
│   └── ws-event.interface.ts
└── guards/
    └── ws-auth.guard.ts
```

**WebSocket Event Types**:

```typescript
type WSEvent =
  | {
      type: 'holon_status_changed';
      holonId: string;
      oldStatus: string;
      newStatus: string;
    }
  | { type: 'holon_created'; holon: Hollon }
  | { type: 'holon_deleted'; holonId: string }
  | { type: 'message_received'; message: Message }
  | { type: 'task_updated'; task: Task }
  | { type: 'approval_requested'; request: ApprovalRequest }
  | { type: 'log_entry'; holonId: string; log: string };
```

**작업 목록**:

- [ ] @nestjs/websockets, @nestjs/platform-socket.io 설치
- [ ] RealtimeGateway 구현
- [ ] WSAuthGuard 구현 (홀론/사용자 인증)
- [ ] 룸 기반 구독 (organization, team, hollon별)

#### Day 3-4: PostgreSQL LISTEN → WebSocket 브릿지

```typescript
// realtime.gateway.ts
@WebSocketGateway({ cors: true })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly pgListener: PostgresListenerService,
    private readonly messageService: MessageService,
  ) {}

  afterInit(): void {
    // 홀론 상태 변경 구독
    this.pgListener.subscribe('holon_status_changed', (payload) => {
      this.server
        .to(`org:${payload.organization_id}`)
        .emit('holon_status_changed', payload);
    });

    // 승인 요청 구독
    this.pgListener.subscribe('approval_requested', (payload) => {
      this.server
        .to(`hollon:${payload.holon_id}`)
        .emit('approval_requested', payload);
    });
  }

  @SubscribeMessage('subscribe_holon')
  handleSubscribeHolon(client: Socket, hollonId: string): void {
    client.join(`hollon:${hollonId}`);

    // 해당 홀론의 메시지 채널 구독
    this.pgListener.subscribe(`holon_message_${hollonId}`, (payload) => {
      client.emit('message_received', payload);
    });
  }
}
```

**작업 목록**:

- [ ] LISTEN 이벤트 → WebSocket 이벤트 매핑
- [ ] 클라이언트 구독 관리 (join/leave room)
- [ ] 홀론별 메시지 채널 동적 구독
- [ ] 연결 해제 시 정리 로직

#### Day 5: ChannelModule 구현 (그룹 채널)

```
apps/server/src/modules/channel/
├── dto/
│   ├── create-channel.dto.ts
│   └── channel-message.dto.ts
├── entities/
│   ├── channel.entity.ts
│   ├── channel-membership.entity.ts
│   └── channel-message.entity.ts
├── channel.controller.ts
├── channel.service.ts
└── channel.module.ts
```

**작업 목록**:

- [ ] Channel 엔티티 (public, private, direct)
- [ ] ChannelMembership 엔티티
- [ ] ChannelMessage 엔티티 (스레드 지원)
- [ ] ChannelService 구현
- [ ] 채널 메시지 WebSocket 브로드캐스트

---

## Week 9-10: 정기 회의 자동화

### Week 9: 스케줄링 인프라 및 스탠드업

#### Day 1-2: NestJS 스케줄러 설정

```typescript
// app.module.ts
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // ...
  ],
})
export class AppModule {}
```

**작업 목록**:

- [ ] @nestjs/schedule 설치 및 설정
- [ ] 스케줄 작업 모니터링 로깅
- [ ] 실패 재시도 메커니즘

#### Day 3-5: StandupService 구현

```
apps/server/src/modules/meeting/
├── dto/
│   ├── standup-response.dto.ts
│   └── meeting-config.dto.ts
├── entities/
│   └── meeting-record.entity.ts
├── services/
│   ├── standup.service.ts
│   ├── meeting-scheduler.service.ts
│   └── meeting-summary.service.ts
├── meeting.controller.ts
└── meeting.module.ts
```

```typescript
@Injectable()
export class StandupService {
  @Cron('0 9 * * 1-5') // 평일 09:00
  async runDailyStandup(): Promise<void> {
    const teams = await this.teamRepo.find({ where: { isActive: true } });

    for (const team of teams) {
      const hollons = await this.getActiveTeamHollons(team.id);

      // 각 홀론에게 스탠드업 질문 전송
      const responses = await Promise.all(
        hollons.map((h) => this.collectStandupStatus(h)),
      );

      // 요약 생성
      const summary = await this.generateStandupSummary(team, responses);

      // Document로 저장
      await this.documentService.create({
        name: `standup-${team.name}-${format(new Date(), 'yyyy-MM-dd')}`,
        docType: 'meeting',
        content: summary,
        scope: 'team',
        scopeId: team.id,
        autoGenerated: true,
      });

      // 팀 채널에 요약 공유
      await this.channelService.sendToTeamChannel(team.id, summary);
    }
  }

  private async collectStandupStatus(hollon: Hollon): Promise<StandupResponse> {
    // 1. 어제 완료한 태스크
    const completedYesterday = await this.taskService.findCompletedSince(
      hollon.id,
      subDays(new Date(), 1),
    );

    // 2. 오늘 예정 태스크
    const todayTasks = await this.taskService.findAssignedTo(hollon.id, {
      status: ['todo', 'in_progress'],
    });

    // 3. 블로커 확인
    const blockers = await this.findBlockers(hollon.id);

    return {
      hollonId: hollon.id,
      hollonName: hollon.name,
      completedYesterday,
      todayPlan: todayTasks,
      blockers,
    };
  }
}
```

**작업 목록**:

- [ ] StandupService 구현
- [ ] 스탠드업 응답 수집 로직
- [ ] 요약 생성 (템플릿 기반 또는 LLM 활용)
- [ ] Document로 회의록 저장
- [ ] 팀 채널 알림

---

### Week 10: 스프린트 계획 및 회고

#### Day 1-2: SprintPlanningService

```typescript
@Injectable()
export class SprintPlanningService {
  @Cron('0 10 * * 1') // 매주 월요일 10:00
  async runSprintPlanning(): Promise<void> {
    const activeCycles = await this.cycleService.findActive();

    for (const cycle of activeCycles) {
      // 1. 지난 스프린트 완료율 분석
      const lastSprintAnalysis = await this.analyzeLastSprint(cycle);

      // 2. 백로그에서 태스크 선정
      const selectedTasks = await this.selectTasksForSprint(
        cycle,
        lastSprintAnalysis.velocity,
      );

      // 3. 태스크 할당 제안
      const assignments = await this.proposeAssignments(
        selectedTasks,
        cycle.teamId,
      );

      // 4. 계획 문서 생성
      await this.documentService.create({
        name: `sprint-planning-${cycle.name}-${format(new Date(), 'yyyy-MM-dd')}`,
        docType: 'meeting',
        content: this.formatPlanningDocument(
          lastSprintAnalysis,
          selectedTasks,
          assignments,
        ),
        scope: 'project',
        scopeId: cycle.projectId,
      });
    }
  }
}
```

**작업 목록**:

- [ ] SprintPlanningService 구현
- [ ] 벨로시티 계산 로직
- [ ] 태스크 선정 알고리즘 (우선순위, 예상 포인트 기반)
- [ ] 자동 할당 제안

#### Day 3-4: RetrospectiveService

```typescript
@Injectable()
export class RetrospectiveService {
  @Cron('0 16 * * 5') // 매주 금요일 16:00
  async runRetrospective(): Promise<void> {
    const completedCycles = await this.cycleService.findCompletedThisWeek();

    for (const cycle of completedCycles) {
      // 1. 메트릭 수집
      const metrics = await this.collectCycleMetrics(cycle);

      // 2. 각 홀론에게 피드백 요청
      const feedback = await this.collectHollonFeedback(cycle);

      // 3. 개선점 도출
      const improvements = await this.analyzeImprovements(metrics, feedback);

      // 4. 회고 문서 생성
      await this.documentService.create({
        name: `retrospective-${cycle.name}`,
        docType: 'meeting',
        content: this.formatRetrospectiveDocument(
          metrics,
          feedback,
          improvements,
        ),
        scope: 'project',
        scopeId: cycle.projectId,
      });
    }
  }
}
```

**작업 목록**:

- [ ] RetrospectiveService 구현
- [ ] 사이클 메트릭 수집 (완료율, 평균 리드타임 등)
- [ ] 홀론 피드백 수집 메커니즘
- [ ] 개선점 분석 및 문서화

#### Day 5: MeetingScheduler 통합

```typescript
@Injectable()
export class MeetingSchedulerService {
  // 회의 일정 조회
  async getUpcomingMeetings(teamId: string): Promise<MeetingSchedule[]>;

  // 임시 회의 예약
  async scheduleAdHocMeeting(
    config: AdHocMeetingConfig,
  ): Promise<MeetingRecord>;

  // 회의 리마인더
  async sendReminders(): Promise<void>;
}
```

**작업 목록**:

- [ ] MeetingSchedulerService 구현
- [ ] 회의 리마인더 (회의 30분 전 알림)
- [ ] 임시 회의 예약 API

---

## Week 11-12: 협업 패턴

### Week 11: CollaborationService 및 코드 리뷰

#### Day 1-2: CollaborationService 구현

```
apps/server/src/modules/collaboration/
├── dto/
│   ├── collaboration-request.dto.ts
│   └── collaboration-session.dto.ts
├── entities/
│   └── collaboration-session.entity.ts
├── services/
│   ├── collaboration.service.ts
│   ├── pair-programming.service.ts
│   └── knowledge-sharing.service.ts
├── collaboration.controller.ts
└── collaboration.module.ts
```

```typescript
@Injectable()
export class CollaborationService {
  /**
   * 협업 요청 생성
   */
  async requestCollaboration(
    requesterHollonId: string,
    request: CollaborationRequestDto,
  ): Promise<CollaborationSession> {
    // 1. 적합한 협력자 찾기
    const collaborator = await this.findSuitableCollaborator(request);

    // 2. 세션 생성
    const session = await this.sessionRepo.save({
      type: request.type, // 'pair_programming', 'code_review', 'knowledge_sharing'
      requesterHollonId,
      collaboratorHollonId: collaborator.id,
      taskId: request.taskId,
      status: 'pending',
    });

    // 3. 협력자에게 요청 전송
    await this.messageService.send({
      fromHollonId: requesterHollonId,
      toHollonId: collaborator.id,
      messageType: 'collaboration_request',
      content: this.formatCollaborationRequest(request),
    });

    return session;
  }

  /**
   * 협업 세션 시작
   */
  async startSession(sessionId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });

    session.status = 'active';
    session.startedAt = new Date();
    await this.sessionRepo.save(session);

    // 양쪽 홀론에게 세션 시작 알림
    await this.notifySessionStart(session);
  }
}
```

**작업 목록**:

- [ ] CollaborationSession 엔티티
- [ ] CollaborationService 구현
- [ ] 협력자 매칭 알고리즘 (역할, 가용성, 스킬 기반)
- [ ] 협업 요청/수락/거절 플로우

#### Day 3: 임시 홀론 생성 권한 검증 (ssot.md 6.2)

협업 과정에서 임시 홀론(리뷰어 등)을 생성할 때 **인간-홀론 역할 분담** 원칙을 준수해야 합니다:

```typescript
// hollon.service.ts 확장
@Injectable()
export class HollonService {
  /**
   * 임시 홀론 생성 (자율 가능)
   * ssot.md 6.2: 임시 홀론 생성/종료는 홀론이 자율적으로 수행
   */
  async createTemporary(config: CreateTemporaryHollonDto): Promise<Hollon> {
    // 임시 홀론만 자율 생성 가능
    return this.hollonRepo.save({
      ...config,
      lifecycle: 'temporary', // 강제로 temporary
      status: 'idle',
    });
  }

  /**
   * 영구 홀론 생성 (인간 승인 필요)
   * ssot.md 6.2: 영구 홀론 생성/삭제는 인간 승인 필요
   */
  async createPermanent(
    config: CreatePermanentHollonDto,
  ): Promise<ApprovalRequest> {
    // 승인 요청 생성
    const approvalRequest = await this.approvalService.create({
      requestType: 'create_permanent_hollon',
      description: `영구 홀론 생성 요청: ${config.name} (Role: ${config.roleName})`,
      metadata: config,
      requestedBy: config.createdBy,
    });

    return approvalRequest;
  }

  /**
   * 홀론 생성 요청 (lifecycle에 따라 분기)
   */
  async create(
    config: CreateHollonDto,
    requestingHollonId?: string,
  ): Promise<Hollon | ApprovalRequest> {
    if (config.lifecycle === 'permanent') {
      // 영구 홀론: 인간 승인 필요
      return this.createPermanent({
        ...config,
        createdBy: requestingHollonId,
      });
    }

    // 임시 홀론: 자율 생성 가능
    return this.createTemporary({
      ...config,
      createdBy: requestingHollonId,
    });
  }
}
```

**작업 목록**:

- [ ] HollonService에 createTemporary/createPermanent 메서드 분리
- [ ] 영구 홀론 생성 시 ApprovalRequest 자동 생성
- [ ] 승인 완료 후 홀론 생성 이벤트 핸들러

---

#### Day 4-5: CodeReviewService 구현

**Task-PR 연결 흐름 (ssot.md 8.1 기반)**:

```
Task #42: "JWT 인증 미들웨어 구현"
    │
    ├── PR #123 (draft) → 작업 중
    ├── PR #123 (ready_for_review) → 리뷰 요청
    ├── PR #123 (changes_requested) → 수정 필요
    ├── PR #123 (approved) → 승인됨
    └── PR #123 (merged) → Task 완료
```

**리뷰어 할당 전략**:

| PR 유형        | 리뷰어               | 생성 방식      |
| -------------- | -------------------- | -------------- |
| 일반 코드 변경 | 같은 팀 동료 홀론    | 기존 홀론 활용 |
| 보안 관련      | SecurityReviewer     | 임시 홀론 생성 |
| 아키텍처 변경  | ArchitectureReviewer | 임시 홀론 생성 |
| 성능 민감      | PerformanceReviewer  | 임시 홀론 생성 |

```typescript
@Injectable()
export class CodeReviewService {
  /**
   * PR 생성 및 Task 연결
   */
  async createPullRequest(
    taskId: string,
    prData: CreatePRDto,
    authorHollonId: string,
  ): Promise<TaskPullRequest>;

  /**
   * 리뷰 요청 - 리뷰어 자동 할당
   */
  async requestReview(prId: string): Promise<TaskPullRequest>;

  /**
   * 리뷰 제출
   */
  async submitReview(
    prId: string,
    reviewerHollonId: string,
    review: ReviewSubmissionDto,
  ): Promise<TaskPullRequest>;

  /**
   * PR 머지
   */
  async mergePullRequest(prId: string): Promise<void>;

  /**
   * 리뷰어 선택 로직
   */
  private async selectReviewer(
    pr: TaskPullRequest,
  ): Promise<ReviewerSelection> {
    // 1. PR 유형에 따른 전문 리뷰어 필요 여부 판단
    const prType = await this.classifyPRType(pr);

    if (prType === 'security') {
      return this.findOrCreateSpecializedReviewer('SecurityReviewer', pr);
    }
    if (prType === 'architecture') {
      return this.findOrCreateSpecializedReviewer('ArchitectureReviewer', pr);
    }

    // 2. 일반 PR: 같은 팀 동료 홀론
    const teammate = await this.findAvailableTeammate(pr);
    if (teammate) {
      return { hollonId: teammate.id, type: 'team_member' };
    }

    // 3. Fallback: 전문 CodeReviewer
    return this.findOrCreateSpecializedReviewer('CodeReviewer', pr);
  }
}
```

**작업 목록**:

- [ ] TaskPullRequest 엔티티 (이미 정의됨, 확인 필요)
- [ ] CodeReviewService 구현
- [ ] PR 유형 분류 로직 (security, architecture, performance, general)
- [ ] 리뷰어 자동 할당
- [ ] 리뷰 코멘트 및 승인/변경요청 플로우
- [ ] PR 상태 전이 관리

---

### Week 12: 팀 간 협업 및 긴급 대응

#### Day 1-2: CrossTeamCollaborationService

```typescript
@Injectable()
export class CrossTeamCollaborationService {
  /**
   * 팀 간 의존성 요청
   */
  async requestDependency(
    requesterTeamId: string,
    targetTeamId: string,
    request: DependencyRequestDto,
  ): Promise<CrossTeamContract> {
    // 1. Contract 생성
    const contract = await this.contractRepo.save({
      requesterTeamId,
      targetTeamId,
      description: request.description,
      deliverables: request.deliverables,
      requestedDeadline: request.deadline,
      status: 'pending',
    });

    // 2. 대상 팀 리더에게 알림
    const targetLeader = await this.teamService.getLeader(targetTeamId);
    await this.messageService.send({
      toHollonId: targetLeader.id,
      messageType: 'dependency_request',
      content: this.formatDependencyRequest(contract),
    });

    return contract;
  }

  /**
   * Contract 협상 및 수락
   */
  async negotiateContract(
    contractId: string,
    response: ContractNegotiationDto,
  ): Promise<CrossTeamContract>;

  /**
   * Contract 이행 확인
   */
  async confirmDelivery(
    contractId: string,
    deliverables: string[],
  ): Promise<void>;
}
```

**작업 목록**:

- [ ] CrossTeamContract 엔티티
- [ ] CrossTeamCollaborationService 구현
- [ ] Contract 상태 관리 (pending → negotiating → accepted → in_progress → delivered)
- [ ] 팀 간 커뮤니케이션 채널

#### Day 3-4: IncidentResponseService

**긴급 대응 정책 (ssot.md 8.4 기반)**:

| 등급   | 기준             | 대응                            |
| ------ | ---------------- | ------------------------------- |
| **P1** | 전체 시스템 영향 | 즉시 인간 알림 + 모든 작업 중단 |
| **P2** | 주요 기능 영향   | 인간 알림 + 관련 작업 중단      |
| **P3** | 부분 영향        | 홀론 자체 해결 시도             |
| **P4** | 경미한 이슈      | 백로그에 추가                   |

```typescript
@Injectable()
export class IncidentResponseService {
  /**
   * 인시던트 처리
   */
  async handleIncident(incident: IncidentDto): Promise<IncidentResponse> {
    // 1. 심각도 분류 (P1-P4)
    const severity = this.classifySeverity(incident);

    // 2. 자동 대응 (ssot.md 정책 기반)
    if (severity <= 2) {
      // P1, P2
      await this.pauseNonEssentialTasks();
      await this.notifyHumans(incident);
    }

    // 3. Owner 할당
    const owner = await this.assignIncidentOwner(incident, severity);

    // 4. 인시던트 채널 생성
    const channel = await this.channelService.create({
      name: `incident-${incident.id}`,
      channelType: 'private',
      description: incident.description,
    });

    // 5. 영향 분석
    const impact = await this.analyzeImpact(incident);

    // 6. 타임라인 기록 시작
    await this.startIncidentTimeline(incident.id);

    return { incident, owner, channel, impact, severity };
  }

  /**
   * Postmortem 생성
   */
  async generatePostmortem(incidentId: string): Promise<Document> {
    const incident = await this.getIncidentWithTimeline(incidentId);

    const postmortem = await this.documentService.create({
      name: `postmortem-${incident.id}`,
      docType: 'postmortem',
      content: this.formatPostmortem(incident),
      scope: 'organization',
      scopeId: incident.organizationId,
    });

    return postmortem;
  }
}
```

**작업 목록**:

- [ ] Incident 엔티티
- [ ] IncidentTimeline 엔티티
- [ ] IncidentResponseService 구현
- [ ] 심각도 분류 로직
- [ ] 비필수 태스크 일시 중지 기능
- [ ] Postmortem 자동 생성

#### Day 5: ConflictResolutionService

```typescript
@Injectable()
export class ConflictResolutionService {
  /**
   * 충돌 감지 및 해결
   */
  async detectAndResolve(
    context: ConflictContext,
  ): Promise<ConflictResolution> {
    const conflicts = await this.detectConflicts(context);

    if (conflicts.length === 0) {
      return { hasConflicts: false };
    }

    // 충돌 유형별 해결 전략
    const resolutions = await Promise.all(
      conflicts.map(async (conflict) => {
        switch (conflict.type) {
          case 'file_conflict':
            return this.resolveFileConflict(conflict);
          case 'resource_conflict':
            return this.resolveResourceConflict(conflict);
          case 'priority_conflict':
            return this.resolvePriorityConflict(conflict);
          case 'deadline_conflict':
            return this.resolveDeadlineConflict(conflict);
          default:
            return this.escalateConflict(conflict);
        }
      }),
    );

    return { hasConflicts: true, resolutions };
  }

  /**
   * 파일 충돌 해결
   */
  private async resolveFileConflict(
    conflict: FileConflict,
  ): Promise<Resolution> {
    // 먼저 시작한 태스크에게 우선권
    const tasks = await this.taskService.findByAffectedFiles(conflict.files);
    const sortedByStart = tasks.sort(
      (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
    );

    // 나중 태스크는 대기 상태로
    for (let i = 1; i < sortedByStart.length; i++) {
      await this.taskService.update(sortedByStart[i].id, { status: 'waiting' });
      await this.messageService.send({
        toHollonId: sortedByStart[i].assignedHollonId,
        messageType: 'conflict_notification',
        content: `파일 충돌로 인해 ${sortedByStart[0].title} 완료 후 진행합니다.`,
      });
    }

    return {
      type: 'file_conflict',
      resolved: true,
      action: 'sequential_execution',
    };
  }
}
```

**작업 목록**:

- [ ] ConflictResolutionService 구현
- [ ] 파일 충돌 감지 및 해결
- [ ] 리소스 충돌 처리
- [ ] 우선순위 충돌 조정
- [ ] 에스컬레이션 플로우

---

## 기술 스택 (Phase 2 추가)

| 영역               | 기술                  | 버전 |
| ------------------ | --------------------- | ---- |
| WebSocket          | Socket.io             | 4.x  |
| WebSocket (NestJS) | @nestjs/websockets    | 10.x |
| Scheduler          | @nestjs/schedule      | 4.x  |
| Event Emitter      | @nestjs/event-emitter | 2.x  |

---

## 리스크 및 완화 계획

| 리스크                          | 확률 | 영향 | 완화 계획                         |
| ------------------------------- | ---- | ---- | --------------------------------- |
| WebSocket 연결 불안정           | 중간 | 높음 | 재연결 로직, 폴링 폴백            |
| PostgreSQL LISTEN 연결 끊김     | 중간 | 높음 | 연결 모니터링, 자동 재연결        |
| 스탠드업 수집 시 홀론 응답 지연 | 높음 | 중간 | 타임아웃 설정, 부분 응답 허용     |
| 팀 간 Contract 이행 실패        | 중간 | 높음 | SLA 모니터링, 에스컬레이션 자동화 |
| 코드 리뷰 병목                  | 높음 | 중간 | 리뷰어 풀 확대, 자동 리뷰 보조    |

---

## 테스트 시나리오

### 시나리오 1: 3홀론 협업 Happy Path

```
1. 3개 홀론 (FrontendDev, BackendDev, QA) 생성
2. 프로젝트에 5개 태스크 생성 (의존성 포함)
3. 각 홀론이 태스크를 Pull하여 실행
4. BackendDev → FrontendDev 협업 요청
5. FrontendDev PR 생성 → QA 리뷰 → 머지
6. 스탠드업 시간에 자동 요약 생성 확인
```

### 시나리오 2: 팀 간 의존성

```
1. Team A, Team B 생성 (각 2홀론)
2. Team A 태스크가 Team B API에 의존
3. CrossTeamContract 생성 및 협상
4. Team B API 완료 → Team A 진행
5. Contract 이행 확인
```

### 시나리오 3: 인시던트 대응

```
1. P2 인시던트 발생 시뮬레이션
2. 자동 인시던트 채널 생성 확인
3. Owner 할당 확인
4. 비필수 태스크 일시 중지 확인
5. Postmortem 자동 생성 확인
```

### 시나리오 4: 파일 충돌 해결

```
1. 2개 홀론이 동일 파일 수정 태스크 할당
2. 충돌 감지 확인
3. 우선순위 기반 순차 실행 확인
4. 대기 홀론에게 알림 확인
```

---

## 추가 구현 항목 (ssot.md/blueprint.md 기반)

### 기술 부채 주간 리뷰

ssot.md 8.2에 명시된 **기술 부채 리뷰** 자동화:

```typescript
@Injectable()
export class TechDebtReviewService {
  @Cron('0 14 * * 3') // 매주 수요일 14:00
  async runWeeklyTechDebtReview(): Promise<void> {
    const orgs = await this.orgRepo.find();

    for (const org of orgs) {
      // 1. 우선순위 높은 부채 조회
      const debts = await this.techDebtService.findTopPriority(org.id, 10);

      // 2. 이자 누적 업데이트
      await this.techDebtService.updateInterest(org.id);

      // 3. 다음 스프린트 부채 예산 (20%) 계산
      const nextCycle = await this.cycleService.findUpcoming(org.id);
      const debtBudget = nextCycle
        ? Math.floor(nextCycle.budgetCents * 0.2)
        : 0;

      // 4. 해결 대상 선정 및 스케줄링
      const scheduled = await this.scheduleDebtResolution(debts, debtBudget);

      // 5. 리뷰 문서 생성
      await this.documentService.create({
        name: `tech-debt-review-${format(new Date(), 'yyyy-MM-dd')}`,
        docType: 'meeting',
        content: this.formatTechDebtReview(debts, scheduled, debtBudget),
        scope: 'organization',
        scopeId: org.id,
      });
    }
  }
}
```

**작업 목록**:

- [ ] TechDebtReviewService 구현
- [ ] 이자 누적 로직 (Priority Score 계산)
- [ ] 스프린트별 부채 예산 20% 할당
- [ ] 부채 해결 태스크 자동 생성

### 불확실성 의사결정 (Spike) - 선택적 구현

> **참고**: 이 항목은 ssot.md 8.5에 명시되어 있으나, blueprint.md Phase 2 로드맵에는 포함되지 않았습니다.
> 시간이 허용되면 구현하고, 그렇지 않으면 Phase 3로 이월합니다.

ssot.md 8.5에 명시된 **Time-boxed 실험(Spike)** 지원:

```typescript
@Injectable()
export class UncertaintyDecisionService {
  /**
   * 불확실성 해소를 위한 Spike 생성
   */
  async createSpike(spikeConfig: SpikeConfig): Promise<Task> {
    // 자율 결정 가능 조건 체크
    if (!spikeConfig.isReversible) {
      throw new EscalationRequiredError('irreversible_decision');
    }
    if (spikeConfig.estimatedCost > spikeConfig.costThreshold) {
      throw new EscalationRequiredError('cost_exceeded');
    }
    if (spikeConfig.hasExternalImpact) {
      throw new EscalationRequiredError('external_impact');
    }

    return this.taskService.create({
      title: `[Spike] ${spikeConfig.objective}`,
      description: spikeConfig.description,
      priority: 'high',
      labels: ['spike', 'experiment'],
      // Spike 제한
      metadata: {
        timeBoxMinutes: spikeConfig.timeLimit,
        costLimitCents: spikeConfig.costLimit,
        successCriteria: spikeConfig.successCriteria,
      },
    });
  }

  /**
   * 자율 결정 가능 여부 판단
   */
  async canDecideAutonomously(context: DecisionContext): Promise<boolean> {
    return (
      context.isReversible &&
      context.estimatedCost <= context.costThreshold &&
      !context.hasExternalImpact
    );
  }
}
```

**작업 목록**:

- [ ] UncertaintyDecisionService 구현
- [ ] Spike 태스크 생성 및 제한 적용
- [ ] 자율 결정 조건 검증

### 홀론 성과 평가 (ssot.md 6.6) - 선택적 구현

> **참고**: 이 항목은 ssot.md 6.6에 명시되어 있으나, blueprint.md Phase 2 로드맵에는 포함되지 않았습니다.
> 시간이 허용되면 구현하고, 그렇지 않으면 Phase 4 (학습 및 성장)로 이월합니다.

매 사이클 종료 시 홀론 성과 자동 집계:

```typescript
@Injectable()
export class HollonPerformanceService {
  /**
   * 사이클 종료 시 성과 집계
   */
  async evaluateCyclePerformance(cycleId: string): Promise<void> {
    const cycle = await this.cycleService.findOne(cycleId);
    const hollons = await this.hollonService.findByCycle(cycleId);

    for (const hollon of hollons) {
      const metrics = await this.collectMetrics(hollon.id, cycle);

      // 평가 지표 (ssot.md 기반)
      const productivity = this.calculateProductivity(metrics); // 40%
      const quality = this.calculateQuality(metrics); // 35%
      const collaboration = this.calculateCollaboration(metrics); // 25%

      const overallScore =
        productivity * 0.4 + quality * 0.35 + collaboration * 0.25;

      await this.performanceSummaryRepo.upsert({
        hollonId: hollon.id,
        totalTasksCompleted: metrics.tasksCompleted,
        totalStoryPointsCompleted: metrics.storyPoints,
        avgTaskCompletionHours: metrics.avgCompletionTime,
        productivityScore: productivity,
        qualityScore: quality,
        collaborationScore: collaboration,
        overallScore,
        updatedAt: new Date(),
      });
    }
  }
}
```

**작업 목록**:

- [ ] HollonPerformanceService 구현
- [ ] 생산성/품질/협업 점수 계산 로직
- [ ] holon_performance_summary 테이블 활용
- [ ] 태스크 할당 시 역량 기반 매칭

### 협업 흐름 다이어그램 (ssot.md 4.4 기반)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           일상적 협업                                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  [매일 09:00] 스탠드업                                                    │
│       │                                                                   │
│       ├─ 각 홀론 상태 수집 (어제 완료 / 오늘 계획 / 블로커)                │
│       └─ 요약 Document 생성 → Channel에 공유                              │
│                                                                           │
│  [사이클 시작] 스프린트 플래닝                                             │
│       │                                                                   │
│       └─ 백로그 우선순위 → 태스크 할당 제안                               │
│                                                                           │
│  [사이클 종료] 회고                                                       │
│       │                                                                   │
│       └─ 메트릭 분석 → 개선점 Document 생성                               │
│                                                                           │
│  [매주 수요일] 기술 부채 리뷰                                              │
│       │                                                                   │
│       └─ 부채 현황 → 우선순위 재조정 → 해결 태스크 생성                    │
│                                                                           │
├──────────────────────────────────────────────────────────────────────────┤
│                           팀 간 협업                                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Team A (요청)              Contract              Team B (제공)           │
│       │                        │                        │                 │
│       ├── 의존성 요청 ─────────┼──────────────────────▶│                 │
│       │                        │                        │                 │
│       │                   [제공 범위]              검토 및 수락           │
│       │                   [API 스펙]                    │                 │
│       │                   [일정/우선순위]               │                 │
│       │                   [변경 통보 의무]              │                 │
│       │                        │                        │                 │
│       │◀─────── 작업 완료 및 전달 ──────────────────────│                 │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 2 완료 후 다음 단계

Phase 3 준비:

- 목표 관리 시스템 (OKR 구조의 Goal Entity)
- GoalDecompositionService: 목표 → 프로젝트/마일스톤/태스크 자동 분해
- PriorityRebalancerService: 동적 우선순위 재조정
- PivotResponseService: 전략 변경(피벗) 대응
  - 영향 분석 (자율)
  - 작업 중단 (자율)
  - 자산 분류: 재활용/보관/폐기 (자율)
  - 새 방향 실행 (인간 승인 후)
