# 🚀 Phase 5: 웹 UI 및 외부 연동 (6주, 3개 스프린트)

> **작성일**: 2025-12-12
> **목표**: 인간이 시스템을 모니터링하고 전략적 개입을 수행하는 완전한 인터페이스 + 외부 시스템 연동
> **기간**: 6주 (Phase 5.1, 5.2, 5.3)
> **우선순위**: CLI Tool + UI 중점, Phase 4에서 미구현된 기능 완성

---

## 📖 목차

1. [Phase 5 목표](#-phase-5-목표)
2. [주차별 계획](#-주차별-계획)
3. [SSOT 완전 달성](#-ssot-완전-달성)
4. [성공 기준](#-성공-기준)

---

## 🎯 Phase 5 목표

### 핵심 목표

**사용자가 모든 기능을 웹 UI를 통해 사용할 수 있고, 외부 시스템과 완벽하게 통합된 프로덕션 레벨 시스템 완성**

### 세부 목표

1. **Backend API & CLI Tool** (Phase 5.1, Week 1-2)
   - HollonActionsController (Hollon 자율 액션 API)
   - Hollon CLI Tool (LLM이 직접 사용 가능한 CLI)
   - 실시간 부모/팀 소통 인프라
   - Next.js 14 프로젝트 초기 설정

2. **Interactive Web UI** (Phase 5.2, Week 3-4)
   - Approval Center (인간 승인 워크플로우)
   - Goal 설정 UI
   - Channel/Message UI (협업 인터페이스)
   - 대시보드 및 모니터링

3. **외부 연동 & 미구현 기능 완성** (Phase 5.3, Week 5-6)
   - GitHub Integration (이슈/PR 동기화)
   - Slack Integration (알림 및 협업)
   - Contract 시스템 (팀 간 협업 계약)
   - 자율 Goal 제안 (초기 버전)
   - Incident Response 고도화

### SSOT 완전 달성

Phase 5 완성 시 SSOT.md의 모든 기본 기능이 구현됩니다.

| SSOT 항목               | 현재 상태   | Phase 5 완료 시 |
| ----------------------- | ----------- | --------------- |
| § 3 핵심 엔티티         | ⚠️ UI 없음  | ✅ 전체 UI      |
| § 4.4 협업 흐름         | ✅ 백엔드만 | ✅ UI 포함      |
| § 6.8 자율 Goal 생성    | ❌          | ✅ 초기 버전    |
| § 8.3 Contract 시스템   | ❌          | ✅ 완료         |
| § 8.4 Incident Response | ⚠️ 기본만   | ✅ 고도화       |

---

## 📅 주차별 계획

### Phase 5.1 (Week 1-2): Backend API & CLI Tool

#### 목표

**Hollon이 능동적으로 부모/팀과 소통할 수 있는 CLI 도구 구축 (Cron 기반 → Active 행동)**

#### 핵심 컨셉: Passive → Active Hollon

**기존 (Cron 기반, Passive)**:

- ⏰ 10분마다 Cron이 Hollon 깨움
- 🔄 Hollon은 시스템이 호출할 때까지 대기
- 📊 상태 전파: 최대 10분 지연

**신규 (CLI 기반, Active)**:

- 🤖 Brain Provider 실행 중 **LLM이 직접 CLI 사용**
- 💬 즉시 부모에게 상태 보고: `hollon-cli notify parent "50% complete"`
- ❓ 팀에게 질문: `hollon-cli ask team "API endpoint 어디?"`
- 🚨 블로커 발생 시 즉시 에스컬레이션: `hollon-cli escalate "dependency blocked"`

#### 구현 내용

**1. HollonActionsController (백엔드 API)**

```typescript
// apps/server/src/modules/hollon-actions/hollon-actions.controller.ts

@Controller('hollon-actions')
@ApiTags('Hollon Actions')
export class HollonActionsController {
  constructor(
    private readonly hollonService: HollonService,
    private readonly taskService: TaskService,
    private readonly channelService: ChannelService,
    private readonly messageService: MessageService,
  ) {}

  /**
   * 부모/팀/매니저에게 알림 전송
   * CLI: hollon-cli notify <target> <message>
   */
  @Post('notify')
  async notify(@Body() dto: NotifyDto) {
    const { hollonId, taskId, target, message } = dto;

    const hollon = await this.hollonService.findOne(hollonId);
    const task = await this.taskService.findOne(taskId);

    switch (target) {
      case 'parent':
        // 부모 Task의 담당 Hollon에게 DM
        if (task.parentTaskId) {
          const parentTask = await this.taskService.findOne(task.parentTaskId);
          if (parentTask.assignedHollonId) {
            await this.messageService.sendDirect({
              fromHollonId: hollonId,
              toHollonId: parentTask.assignedHollonId,
              content: `[${task.title}] ${message}`,
            });
          }
          // 부모 Task의 Note에도 기록
          await this.taskService.addNote(parentTask.id, {
            content: `[${hollon.name}] ${message}`,
            createdBy: hollonId,
          });
        }
        break;

      case 'team':
        // Team Channel에 메시지 전송
        const teamChannel = await this.channelService.findOrCreate(
          hollon.teamId,
          'team-updates',
        );
        await this.channelService.postMessage(teamChannel, {
          senderId: hollonId,
          content: `**${hollon.name}** (${task.title}): ${message}`,
        });
        break;

      case 'manager':
        // 팀 매니저에게 DM
        const team = await this.teamService.findOne(hollon.teamId);
        if (team.managerHollonId) {
          await this.messageService.sendDirect({
            fromHollonId: hollonId,
            toHollonId: team.managerHollonId,
            content: `[${task.title}] ${message}`,
          });
        }
        break;
    }

    return { success: true, target, message };
  }

  /**
   * 팀/특정 Hollon에게 질문
   * CLI: hollon-cli ask <target> <question>
   */
  @Post('ask')
  async ask(@Body() dto: AskDto) {
    const { hollonId, target, question } = dto;

    const hollon = await this.hollonService.findOne(hollonId);

    if (target.startsWith('hollon:')) {
      // 특정 Hollon에게 질문
      const targetHollonId = target.split(':')[1];
      const message = await this.messageService.sendDirect({
        fromHollonId: hollonId,
        toHollonId: targetHollonId,
        content: question,
      });

      // 답변 대기 (실시간이 아닌 경우 polling 또는 webhook)
      // 여기서는 간단히 비동기 처리
      return { success: true, messageId: message.id, status: 'sent' };
    } else if (target === 'team') {
      // Team Channel에 질문 게시
      const teamChannel = await this.channelService.findOrCreate(
        hollon.teamId,
        'team-questions',
      );
      const message = await this.channelService.postMessage(teamChannel, {
        senderId: hollonId,
        content: `❓ **${hollon.name}** asks: ${question}`,
      });

      return { success: true, channelMessageId: message.id };
    }
  }

  /**
   * 블로커 에스컬레이션
   * CLI: hollon-cli escalate <reason>
   */
  @Post('escalate')
  async escalate(@Body() dto: EscalateDto) {
    const { hollonId, taskId, reason } = dto;

    const task = await this.taskService.findOne(taskId);
    const hollon = await this.hollonService.findOne(hollonId);

    // Task 상태 업데이트
    await this.taskService.update(taskId, {
      status: TaskStatus.BLOCKED,
    });

    // 부모 Task 담당자에게 알림
    if (task.parentTaskId) {
      const parentTask = await this.taskService.findOne(task.parentTaskId);
      if (parentTask.assignedHollonId) {
        await this.messageService.sendDirect({
          fromHollonId: hollonId,
          toHollonId: parentTask.assignedHollonId,
          content: `🚨 **Escalation**: ${task.title}\n\nReason: ${reason}`,
        });
      }
    }

    // Incident Channel에도 게시
    const incidentChannel = await this.channelService.findOrCreate(
      hollon.teamId,
      'incidents',
    );
    await this.channelService.postMessage(incidentChannel, {
      senderId: hollonId,
      content: `🚨 **${hollon.name}** escalated task "${task.title}"\n\n**Reason**: ${reason}`,
    });

    return { success: true, taskStatus: 'blocked' };
  }

  /**
   * 지식 검색
   * CLI: hollon-cli search <query>
   */
  @Post('search')
  async search(@Body() dto: SearchDto) {
    const { hollonId, query, scope } = dto;

    const hollon = await this.hollonService.findOne(hollonId);

    // Vector + Graph RAG 검색 (Phase 4에서 구현)
    const results = await this.knowledgeService.hybridSearch(query, {
      scope: scope || 'team',
      scopeId: scope === 'team' ? hollon.teamId : hollon.organizationId,
      limit: 5,
    });

    return {
      success: true,
      results: results.map((doc) => ({
        id: doc.id,
        title: doc.title,
        summary: doc.summary,
        relevanceScore: doc.relevanceScore,
      })),
    };
  }

  /**
   * 다음 Task 조회
   * CLI: hollon-cli next-task
   */
  @Post('next-task')
  async getNextTask(@Body() dto: { hollonId: string }) {
    const { hollonId } = dto;

    const nextTask = await this.taskService.findNextTaskForHollon(hollonId);

    if (!nextTask) {
      return { success: true, task: null, message: 'No pending tasks' };
    }

    return { success: true, task: nextTask };
  }
}
```

**2. Hollon CLI Tool (apps/cli)**

```typescript
// apps/cli/src/index.ts

import { Command } from 'commander';
import axios from 'axios';

const program = new Command();

const API_URL = process.env.HOLLON_API_URL || 'http://localhost:3000';
const HOLLON_ID = process.env.HOLLON_ID; // Brain Provider가 환경 변수로 설정
const TASK_ID = process.env.TASK_ID;

// 부모/팀 알림
program
  .command('notify <target> <message>')
  .description('Notify parent, team, or manager')
  .action(async (target, message) => {
    try {
      const response = await axios.post(`${API_URL}/hollon-actions/notify`, {
        hollonId: HOLLON_ID,
        taskId: TASK_ID,
        target,
        message,
      });
      console.log(`✅ Notification sent to ${target}`);
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// 질문
program
  .command('ask <target> <question>')
  .description('Ask question to team or specific hollon')
  .action(async (target, question) => {
    try {
      const response = await axios.post(`${API_URL}/hollon-actions/ask`, {
        hollonId: HOLLON_ID,
        target,
        question,
      });
      console.log(`✅ Question sent to ${target}`);
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// 에스컬레이션
program
  .command('escalate <reason>')
  .description('Escalate task due to blocker')
  .action(async (reason) => {
    try {
      const response = await axios.post(`${API_URL}/hollon-actions/escalate`, {
        hollonId: HOLLON_ID,
        taskId: TASK_ID,
        reason,
      });
      console.log('🚨 Task escalated');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// 지식 검색
program
  .command('search <query>')
  .option('-s, --scope <scope>', 'Search scope (team or org)', 'team')
  .description('Search knowledge base')
  .action(async (query, options) => {
    try {
      const response = await axios.post(`${API_URL}/hollon-actions/search`, {
        hollonId: HOLLON_ID,
        query,
        scope: options.scope,
      });
      console.log('🔍 Search results:');
      response.data.results.forEach((result, i) => {
        console.log(
          `\n${i + 1}. ${result.title} (score: ${result.relevanceScore})`,
        );
        console.log(`   ${result.summary}`);
      });
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// 다음 Task 조회
program
  .command('next-task')
  .description('Get next available task')
  .action(async () => {
    try {
      const response = await axios.post(`${API_URL}/hollon-actions/next-task`, {
        hollonId: HOLLON_ID,
      });
      if (response.data.task) {
        console.log('📋 Next task:');
        console.log(JSON.stringify(response.data.task, null, 2));
      } else {
        console.log('✅ No pending tasks');
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
```

**3. Brain Provider 통합 (System Prompt에 CLI 사용법 추가)**

```typescript
// apps/server/src/modules/brain-provider/templates/system-prompt.ts

export const systemPromptWithCLI = `
You are ${hollon.name}, a ${hollon.role.name} in the Hollon AI system.

...

**Available CLI Commands**:
You can use the following CLI commands during your execution:

1. **hollon-cli notify <target> <message>**
   - Notify parent, team, or manager
   - Example: hollon-cli notify parent "Task 50% complete, API integration done"
   - Targets: parent, team, manager

2. **hollon-cli ask <target> <question>**
   - Ask question to team or specific hollon
   - Example: hollon-cli ask team "Where is the API endpoint documentation?"
   - Example: hollon-cli ask hollon:abc-123 "Can you review this PR?"

3. **hollon-cli escalate <reason>**
   - Escalate task due to blocker
   - Example: hollon-cli escalate "Dependency library version conflict"

4. **hollon-cli search <query>**
   - Search knowledge base
   - Example: hollon-cli search "authentication implementation"

5. **hollon-cli next-task**
   - Get your next available task

**When to use CLI**:
- Notify parent when you reach a milestone (25%, 50%, 75% complete)
- Ask team when you need information from others
- Escalate immediately when you encounter a blocker (don't wait for next Cron)
- Search knowledge before asking team (avoid duplicate questions)
`;
```

**4. Next.js 프로젝트 초기 설정 (간단 버전)**

```bash
# 모노레포 구조
apps/
  web/  # Next.js 14 (App Router)
    app/
      layout.tsx
      page.tsx  # 랜딩 페이지
      (dashboard)/
        layout.tsx
        page.tsx  # 대시보드 홈
    lib/
      api-client.ts
```

#### 테스트

- `hollon-actions.controller.spec.ts` (단위 테스트)
- `hollon-cli.e2e-spec.ts` (CLI E2E 테스트)
- `phase5.1-cli-integration.e2e-spec.ts` (통합 테스트)

#### 성공 기준

- [ ] HollonActionsController API 동작
- [ ] hollon-cli 5가지 명령어 모두 동작
- [ ] Brain Provider에서 CLI 호출 시 실시간 전파
- [ ] Next.js 기본 프로젝트 설정 완료

#### 주요 이점

| 측면          | 기존 (Cron)                | 신규 (CLI)             |
| ------------- | -------------------------- | ---------------------- |
| **자율성**    | Passive (시스템이 깨움)    | Active (Hollon이 결정) |
| **지연 시간** | 최대 10분                  | 즉시 (0초)             |
| **비용**      | 주기적 Brain Provider 호출 | 필요 시에만 호출       |
| **지능**      | 시스템이 결정              | Hollon이 결정          |

---

### Phase 5.2 (Week 3-4): Interactive Web UI (Approval Center + Channel)

#### 목표

인간이 승인하고 협업하는 핵심 인터페이스 구축

#### 구현 내용

**1. Approval Center (승인 센터)**

```typescript
// apps/web/app/(dashboard)/approvals/page.tsx

export default function ApprovalCenter() {
  const { data: requests } = useApprovalRequests({ status: 'pending' });

  return (
    <div>
      <h1>Approval Requests</h1>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({requests.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {requests.map(request => (
            <ApprovalRequestCard key={request.id} request={request} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// 개별 승인 요청 카드
function ApprovalRequestCard({ request }: { request: ApprovalRequest }) {
  const { mutate: approve } = useApproveRequest();
  const { mutate: reject } = useRejectRequest();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{request.requestType}</CardTitle>
        <CardDescription>
          Requested by {request.requestedBy.name} • {formatDate(request.createdAt)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h4>Context</h4>
            <pre className="bg-muted p-4 rounded">{JSON.stringify(request.context, null, 2)}</pre>
          </div>

          {request.options && (
            <div>
              <h4>Options</h4>
              <RadioGroup>
                {request.options.map(option => (
                  <div key={option.id}>
                    <RadioGroupItem value={option.id} />
                    <Label>{option.label}</Label>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="default" onClick={() => approve(request.id)}>
          Approve
        </Button>
        <Button variant="destructive" onClick={() => reject(request.id)}>
          Reject
        </Button>
        <Button variant="outline">
          Request More Info
        </Button>
      </CardFooter>
    </Card>
  );
}
```

**2. Goal 설정 UI**

```typescript
// apps/web/app/(dashboard)/goals/new/page.tsx

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const goalSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(20),
  goalType: z.enum(['objective', 'key_result', 'project']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  targetDate: z.date(),
  successCriteria: z.array(z.string()).min(1),
});

export default function NewGoal() {
  const form = useForm({
    resolver: zodResolver(goalSchema),
  });

  const { mutate: createGoal } = useCreateGoal();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(data => createGoal(data))}>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Q1 2025: Improve System Reliability" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* description, goalType, priority, targetDate, successCriteria */}

        <Button type="submit">Create Goal</Button>
      </form>
    </Form>
  );
}
```

**3. Channel UI (협업 채팅)**

```typescript
// apps/web/app/(dashboard)/channels/[id]/page.tsx

'use client';

export default function ChannelView({ params }: { params: { id: string } }) {
  const { data: channel } = useChannel(params.id);
  const { data: messages } = useChannelMessages(params.id);
  const { mutate: sendMessage } = useSendChannelMessage();

  const [message, setMessage] = useState('');

  return (
    <div className="flex h-screen">
      {/* 왼쪽: Channel 목록 */}
      <aside className="w-64 border-r">
        <ChannelList />
      </aside>

      {/* 중앙: 메시지 영역 */}
      <div className="flex-1 flex flex-col">
        {/* 상단: Channel 헤더 */}
        <header className="border-b p-4">
          <h2 className="text-lg font-bold">#{channel.name}</h2>
          <p className="text-sm text-muted-foreground">{channel.description}</p>
        </header>

        {/* 메시지 목록 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className="flex gap-3">
              <Avatar>
                <AvatarImage src={msg.sender?.avatar} />
                <AvatarFallback>{msg.sender?.name?.[0] || 'S'}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{msg.sender?.name || 'System'}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 하단: 메시지 입력 */}
        <div className="border-t p-4">
          <form onSubmit={(e) => {
            e.preventDefault();
            sendMessage({ channelId: params.id, content: message });
            setMessage('');
          }}>
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Send a message..."
              />
              <Button type="submit">Send</Button>
            </div>
          </form>
        </div>
      </div>

      {/* 오른쪽: Channel 정보 */}
      <aside className="w-64 border-l p-4">
        <h3 className="font-semibold mb-2">Members</h3>
        <div className="space-y-2">
          {channel.members.map(member => (
            <div key={member.id} className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback>{member.name[0]}</AvatarFallback>
              </Avatar>
              <span className="text-sm">{member.name}</span>
              <Badge variant="outline" className="ml-auto text-xs">
                {member.status}
              </Badge>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
```

**4. Message UI (1:1 DM)**

```typescript
// apps/web/app/(dashboard)/messages/page.tsx

// Slack 스타일 DM 인터페이스
// Channel UI와 유사하지만 1:1 대화에 최적화
```

#### 테스트

- `approval-center.spec.ts`
- `goal-form.spec.ts`
- `channel-ui.spec.ts`

#### 성공 기준

- [ ] Approval Center에서 승인/거부
- [ ] Goal 생성 폼 동작
- [ ] Channel 메시지 전송/수신
- [ ] Message DM 전송/수신

---

### Phase 5.3 (Week 5-6): 외부 연동 + 미구현 기능 완성

#### 목표

GitHub/Slack 연동, Contract 시스템, 자율 Goal 제안 초기 버전

#### 구현 내용

**1. GitHub Integration**

```typescript
// apps/server/src/modules/integration/github/github.service.ts

@Injectable()
export class GitHubIntegrationService {
  // PR 동기화
  async syncPullRequest(pr: TaskPullRequest) {
    const githubPR = await this.octokit.pulls.get({
      owner: this.config.owner,
      repo: this.config.repo,
      pull_number: pr.githubPrNumber,
    });

    // PR 상태 업데이트
    await this.taskPrService.update(pr.id, {
      status: this.mapGitHubStatus(githubPR.state),
      metadata: {
        ...pr.metadata,
        githubUrl: githubPR.html_url,
        mergeable: githubPR.mergeable,
      },
    });
  }

  // 이슈 → Task 변환
  async importIssueAsTask(issueNumber: number, teamId: string) {
    const issue = await this.octokit.issues.get({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueNumber,
    });

    return await this.taskService.create({
      title: issue.title,
      description: issue.body,
      teamId,
      metadata: {
        githubIssue: issue.number,
        githubUrl: issue.html_url,
      },
    });
  }

  // Webhook 처리
  @Post('webhooks/github')
  async handleGitHubWebhook(@Body() payload: any) {
    // PR 생성/업데이트/머지 이벤트 처리
    // Issue 생성/업데이트/닫기 이벤트 처리
  }
}
```

**2. Slack Integration**

```typescript
// apps/server/src/modules/integration/slack/slack.service.ts

@Injectable()
export class SlackIntegrationService {
  // 알림 전송
  async sendNotification(event: {
    type: 'approval_request' | 'task_completed' | 'incident';
    data: any;
    channel?: string;
  }) {
    const message = this.formatMessage(event);

    await this.slackClient.chat.postMessage({
      channel: event.channel || this.config.defaultChannel,
      blocks: message.blocks,
    });
  }

  // Slack 커맨드 처리
  @Post('webhooks/slack/commands')
  async handleSlackCommand(@Body() payload: any) {
    // /hollon status
    // /hollon assign <task-id> <hollon-id>
    // /hollon approve <approval-id>
  }

  // Channel ↔ Slack 동기화
  async syncChannel(channel: Channel) {
    // Hollon-AI Channel 메시지를 Slack으로 전송
    // Slack 메시지를 Hollon-AI Channel로 가져오기
  }
}
```

**3. Contract 시스템 (팀 간 협업)**

```typescript
// apps/server/src/modules/collaboration/entities/contract.entity.ts

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Team)
  providerTeam: Team; // 제공하는 팀

  @ManyToOne(() => Team)
  consumerTeam: Team; // 요청하는 팀

  @Column()
  title: string; // "User Authentication API"

  @Column({ type: 'text' })
  scope: string; // 제공 범위

  @Column({ type: 'jsonb' })
  apiSpec: {
    endpoints: { method: string; path: string; description: string }[];
    sla: { responseTime: string; availability: string };
  };

  @Column()
  status: 'draft' | 'active' | 'deprecated';

  @Column({ type: 'jsonb', nullable: true })
  changelog: {
    version: string;
    changes: string[];
    notifiedAt: Date;
  }[];
}

// apps/server/src/modules/collaboration/services/contract.service.ts

@Injectable()
export class ContractService {
  // Contract 생성 (제공 팀이 작성)
  async createContract(
    providerTeam: Team,
    data: CreateContractDto,
  ): Promise<Contract>;

  // Contract 수락 (소비 팀이 승인)
  async acceptContract(contractId: string, consumerTeam: Team): Promise<void>;

  // Contract 변경 알림
  async notifyContractChange(
    contractId: string,
    changes: string[],
  ): Promise<void> {
    const contract = await this.findOne(contractId);

    // 소비 팀에게 알림
    await this.channelService.postMessage(
      contract.consumerTeam.generalChannel,
      {
        content: `⚠️ Contract "${contract.title}" has been updated by ${contract.providerTeam.name}.\n\nChanges:\n${changes.map((c) => `- ${c}`).join('\n')}`,
        metadata: { type: 'contract_update', contractId },
      },
    );
  }
}
```

**4. 자율 Goal 제안 (초기 버전)**

```typescript
// apps/server/src/modules/goal/services/goal-proposal.service.ts

@Injectable()
export class GoalProposalService {
  // 메트릭 기반 Goal 제안
  async proposeGoalsFromMetrics(
    organization: Organization,
  ): Promise<GoalProposal[]> {
    // 1. 데이터 수집
    const metrics = {
      techDebt: await this.techDebtService.getHighPriorityDebts(
        organization.id,
      ),
      incidents: await this.incidentService.getRecentIncidents(
        organization.id,
        30,
      ),
      performance: await this.performanceService.getOrganizationMetrics(
        organization.id,
      ),
    };

    // 2. Brain Provider에 Goal 제안 요청
    const response = await this.brainProvider.executeWithTracking({
      systemPrompt: '당신은 전략 분석 전문가입니다.',
      userPrompt: `다음 메트릭을 분석하고, 개선을 위한 Goal을 제안하세요:

        Tech Debt: ${metrics.techDebt.length}개 (Priority > 100)
        Incidents: ${metrics.incidents.filter((i) => i.severity === 'P1').length}개 P1
        Performance: 평균 응답 시간 ${metrics.performance.avgResponseTime}ms

        각 Goal에는:
        - Objective (목표)
        - Key Results (측정 가능한 결과, 3개)
        - 근거 (왜 이 Goal이 필요한가)
        - 예상 ROI

        JSON 형식으로 응답하세요.`,
    });

    const proposals = JSON.parse(response.output);

    // 3. ApprovalRequest 생성
    for (const proposal of proposals) {
      await this.approvalService.create({
        requestType: 'goal_proposal',
        requestedBy: null, // 시스템 자동 제안
        organizationId: organization.id,
        context: {
          proposal,
          metrics,
        },
        options: [
          { id: 'approve', label: 'Approve and Create Goal' },
          { id: 'modify', label: 'Modify Before Creating' },
          { id: 'reject', label: 'Reject' },
        ],
      });
    }

    return proposals;
  }

  // Cron: 매월 1일 실행
  @Cron('0 0 1 * *')
  async monthlyGoalProposal() {
    const orgs = await this.organizationService.findAll();

    for (const org of orgs) {
      if (org.settings.autoGoalProposal === true) {
        await this.proposeGoalsFromMetrics(org);
      }
    }
  }
}
```

**5. Incident Response 고도화**

```typescript
// apps/server/src/modules/incident/services/incident.service.ts

@Injectable()
export class IncidentService {
  // 자동 감지
  async detectIncident(event: {
    type: 'test_failure' | 'build_failure' | 'performance_degradation';
    data: any;
  }) {
    // 패턴 분석
    const severity = await this.analyzeSeverity(event);

    if (severity >= 'P2') {
      const incident = await this.create({
        title: `${event.type}: ${event.data.summary}`,
        severity,
        status: 'open',
        detectedAt: new Date(),
        metadata: event.data,
      });

      // P1/P2는 즉시 인간 알림
      if (severity === 'P1' || severity === 'P2') {
        await this.notifyHumans(incident);
        await this.pauseAffectedTasks(incident);
      }

      return incident;
    }
  }

  // 루트 원인 분석 (RCA)
  async performRootCauseAnalysis(incidentId: string) {
    const incident = await this.findOne(incidentId);

    // Brain Provider에 RCA 요청
    const analysis = await this.brainProvider.executeWithTracking({
      systemPrompt: '당신은 시스템 장애 분석 전문가입니다.',
      userPrompt: `다음 Incident의 루트 원인을 분석하세요:

        ${incident.title}
        ${incident.description}

        관련 데이터:
        ${JSON.stringify(incident.metadata, null, 2)}

        5 Whys 기법을 사용하여 루트 원인을 찾으세요.`,
    });

    await this.update(incidentId, {
      rootCauseAnalysis: analysis.output,
    });
  }
}
```

#### 테스트

- `github-integration.spec.ts`
- `slack-integration.spec.ts`
- `contract.service.spec.ts`
- `goal-proposal.service.spec.ts`
- `incident.service.spec.ts`

#### 성공 기준

- [ ] GitHub PR 동기화
- [ ] Slack 알림 전송
- [ ] Contract 생성 및 알림
- [ ] 자율 Goal 제안 생성
- [ ] Incident 자동 감지 및 RCA

---

## ✅ SSOT 완전 달성

### Phase 5 완료 시 SSOT 달성도: 100%

| SSOT 섹션 | 항목              | Phase 4   | Phase 5      |
| --------- | ----------------- | --------- | ------------ |
| § 3       | 핵심 엔티티       | ✅ 백엔드 | ✅ UI 포함   |
| § 4       | 시스템 작동 방식  | ✅ 완료   | ✅ UI 포함   |
| § 5       | 핵심 원칙         | ✅ 완료   | ✅ 완료      |
| § 6.8     | 자율 Goal 생성    | ❌        | ✅ 초기 버전 |
| § 7       | LLM 한계 대응     | ✅ 완료   | ✅ 완료      |
| § 8.2     | 정기 회의 자동화  | ✅ 완료   | ✅ UI 포함   |
| § 8.3     | Contract 시스템   | ❌        | ✅ 완료      |
| § 8.4     | Incident Response | ⚠️ 기본   | ✅ 고도화    |

---

## 🎯 성공 기준

### Phase 5 완료 기준

| 기준                   | 측정 방법        | 목표           |
| ---------------------- | ---------------- | -------------- |
| **Web UI 완성도**      | 기능별 페이지    | 100%           |
| **실시간 업데이트**    | WebSocket 테스트 | < 1초 지연     |
| **Approval Center**    | E2E 테스트       | 승인/거부 동작 |
| **Channel UI**         | E2E 테스트       | 메시지 송수신  |
| **GitHub Integration** | 통합 테스트      | PR 동기화 100% |
| **Slack Integration**  | 통합 테스트      | 알림 전송 100% |
| **Contract 시스템**    | E2E 테스트       | 생성/알림 동작 |
| **자율 Goal 제안**     | 월별 실행        | 제안 생성      |

### 사용자 수용 테스트

```bash
# 1. Web UI 접속
open http://localhost:3000

# 2. 조직도 확인
# Organization → Teams → Hollons 계층 구조 표시

# 3. Goal 생성 및 자동 분해
# Goal 폼 → 생성 → 자동 분해 → Task 보드에 표시

# 4. Approval 처리
# Approval Center → 승인/거부 → Task 재개

# 5. Channel 협업
# Channel 접속 → 메시지 전송 → Hollon 응답 확인

# 6. 외부 연동
# GitHub PR 생성 → Task 연결 확인
# Slack 알림 수신 확인
```

---

## 📝 Blueprint 업데이트 제안

### 변경 전 (blueprint.md)

```
### Phase 5: 웹 UI 및 외부 연동 - 6주

Week 25-26: 대시보드
Week 27-28: 상호작용 인터페이스
Week 29-30: 외부 연동
```

### 변경 후 (제안)

```
### Phase 5: 웹 UI 및 외부 연동 - 6주

Week 1-2: UI 인프라 및 대시보드
├── Next.js 14 프로젝트 설정
├── 조직도 뷰 (React Flow)
├── 프로젝트 대시보드 (칸반 보드)
├── Hollon 상세 뷰
└── 실시간 업데이트 (WebSocket)

Week 3-4: 상호작용 UI
├── Approval Center (승인 워크플로우)
├── Goal 설정 UI
├── Channel UI (협업 채팅)
└── Message UI (1:1 DM)

Week 5-6: 외부 연동 + 미구현 기능 완성
├── GitHub Integration (PR/Issue 동기화)
├── Slack Integration (알림 및 커맨드)
├── Contract 시스템 (팀 간 협업 계약)
├── 자율 Goal 제안 (초기 버전)
└── Incident Response 고도화
```

---

## 🎉 Phase 5 완성 시 시스템 상태

### 완전한 기능 목록

| 카테고리            | 기능                             | 상태 |
| ------------------- | -------------------------------- | ---- |
| **핵심 워크플로우** | Goal → Task 자동 분해            | ✅   |
|                     | Task 자율 실행                   | ✅   |
|                     | Code Review + Auto Merge         | ✅   |
|                     | Escalation → Approval            | ✅   |
| **협업**            | 1:1 Message                      | ✅   |
|                     | Channel (그룹 채팅)              | ✅   |
|                     | 자동 Standup                     | ✅   |
|                     | 자동 Retrospective               | ✅   |
|                     | Contract (팀 간 협업)            | ✅   |
| **지식**            | Knowledge Extraction             | ✅   |
|                     | Vector RAG                       | ✅   |
|                     | Graph RAG                        | ✅   |
|                     | Best Practice 학습               | ✅   |
| **자기 개선**       | Performance Analyzer             | ✅   |
|                     | Prompt Optimizer                 | ✅   |
|                     | 자율 Goal 제안 (초기)            | ✅   |
| **UI**              | 대시보드 (조직도, 프로젝트 보드) | ✅   |
|                     | Approval Center                  | ✅   |
|                     | Channel/Message UI               | ✅   |
|                     | Goal 설정 UI                     | ✅   |
| **외부 연동**       | GitHub Integration               | ✅   |
|                     | Slack Integration                | ✅   |
| **안전**            | Incident Response                | ✅   |
|                     | Emergency Stop                   | ✅   |
|                     | Quality Gate                     | ✅   |

### 프로덕션 준비도: 95%

**미완성 항목 (Phase 6+)**:

- 고급 자율 Goal 생성 (학습 루프 고도화)
- 멀티 Organization 최적화
- 고급 보안 기능 (RBAC 세분화)
- 성능 최적화 (대규모 Task 처리)

---

## 📝 변경 이력

| 날짜       | 버전 | 변경 내용                                                 |
| ---------- | ---- | --------------------------------------------------------- |
| 2025-12-12 | 1.0  | Phase 5 초기 계획 작성 (Web UI + 외부 연동 + 미구현 기능) |

---

**문서 버전**: 1.0
**최종 업데이트**: 2025-12-12
**작성자**: Claude Code
**상태**: Phase 5 계획 (검토 중)
