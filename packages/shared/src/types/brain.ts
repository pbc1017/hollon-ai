/**
 * Brain Provider 관련 타입
 */

/**
 * Brain Provider 유형
 */
export enum BrainProviderType {
  CLAUDE_CODE = 'claude_code',
  ANTHROPIC_API = 'anthropic_api',
  OPENAI_API = 'openai_api',
}

/**
 * Brain 실행 요청
 */
export interface BrainExecutionRequest {
  prompt: string;
  systemPrompt?: string;
  context?: BrainContext;
  options?: BrainExecutionOptions;
}

/**
 * Brain 컨텍스트
 */
export interface BrainContext {
  taskId: string;
  hollonId: string;
  projectId: string;
  workingDirectory?: string;
  relevantFiles?: string[];
  recentDecisions?: string[];
}

/**
 * Brain 실행 옵션
 */
export interface BrainExecutionOptions {
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
  allowFileOperations?: boolean;
  allowGitOperations?: boolean;
  allowShellCommands?: boolean;
}

/**
 * Brain 실행 결과
 */
export interface BrainExecutionResult {
  success: boolean;
  output: string;
  artifacts?: BrainArtifact[];
  cost?: BrainCost;
  duration: number;
  error?: string;
}

/**
 * Brain 산출물
 */
export interface BrainArtifact {
  type: 'file_created' | 'file_modified' | 'file_deleted' | 'command_executed';
  path?: string;
  command?: string;
  description?: string;
}

/**
 * Brain 비용
 */
export interface BrainCost {
  inputTokens: number;
  outputTokens: number;
  totalCostCents: number;
}

/**
 * Brain Provider 인터페이스
 */
export interface IBrainProvider {
  type: BrainProviderType;
  name: string;

  execute(request: BrainExecutionRequest): Promise<BrainExecutionResult>;
  validateConnection(): Promise<boolean>;
  estimateCost(prompt: string): number;
}
