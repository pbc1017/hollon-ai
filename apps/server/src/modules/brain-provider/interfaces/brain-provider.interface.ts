export interface BrainRequest {
  prompt: string;
  systemPrompt?: string;
  context?: {
    taskId?: string;
    hollonId?: string;
    projectId?: string;
    workingDirectory?: string;
  };
  options?: {
    timeoutMs?: number;
    maxTokens?: number;
    // Phase 4.1 Fix #7: Disallow specific tools (e.g., for decomposition mode)
    disallowedTools?: string[];
  };
}

export interface BrainResponse {
  success: boolean;
  output: string;
  duration: number;
  cost: {
    inputTokens: number;
    outputTokens: number;
    totalCostCents: number;
  };
  metadata?: Record<string, unknown>;
}

export interface IBrainProvider {
  execute(request: BrainRequest): Promise<BrainResponse>;
  healthCheck(): Promise<boolean>;
}
