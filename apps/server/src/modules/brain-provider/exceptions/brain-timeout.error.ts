export class BrainTimeoutError extends Error {
  constructor(
    public readonly timeoutMs: number,
    public readonly actualDuration: number,
  ) {
    super(
      `Brain execution timeout: ${timeoutMs}ms exceeded (actual: ${actualDuration}ms)`,
    );
    this.name = 'BrainTimeoutError';
  }
}
