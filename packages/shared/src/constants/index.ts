/**
 * 안전장치 상수
 */
export const SAFETY_LIMITS = {
  // 서브태스크 재귀 제한
  MAX_SUBTASK_DEPTH: 3,
  MAX_SUBTASKS_PER_TASK: 10,

  // 실행 시간 제한
  DEFAULT_BRAIN_TIMEOUT_MS: 300000, // 5분
  MAX_BRAIN_TIMEOUT_MS: 600000, // 10분

  // 비용 제한 (센트)
  DEFAULT_DAILY_COST_LIMIT_CENTS: 10000, // $100
  DEFAULT_MONTHLY_COST_LIMIT_CENTS: 100000, // $1,000
  COST_ALERT_THRESHOLD_PERCENT: 80,
} as const;

/**
 * TaskPool 상수
 */
export const TASK_POOL = {
  // 태스크 할당 관련
  ASSIGNMENT_BATCH_SIZE: 10,
  READY_CHECK_INTERVAL_MS: 5000,

  // 우선순위 점수
  PRIORITY_SCORES: {
    P1: 100,
    P2: 75,
    P3: 50,
    P4: 25,
  },

  // 대기 시간 보정 (시간당 추가 점수)
  WAITING_TIME_BONUS_PER_HOUR: 5,
} as const;

/**
 * QualityGate 상수
 */
export const QUALITY_GATE = {
  // 자동 승인 기준
  AUTO_APPROVE_THRESHOLD: 0.9,

  // 검증 항목별 가중치
  WEIGHTS: {
    LINT: 0.15,
    TYPE_CHECK: 0.2,
    UNIT_TEST: 0.25,
    ACCEPTANCE_CRITERIA: 0.4,
  },
} as const;

/**
 * Escalation 상수
 */
export const ESCALATION = {
  // 에스컬레이션 트리거
  MAX_RETRY_COUNT: 3,
  STALE_TASK_HOURS: 24,

  // 알림 채널
  CHANNELS: ['slack', 'email', 'in_app'] as const,
} as const;
