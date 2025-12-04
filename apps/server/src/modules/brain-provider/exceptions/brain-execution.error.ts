export class BrainExecutionError extends Error {
  constructor(
    message: string,
    public readonly stderr?: string,
    public readonly exitCode?: number,
  ) {
    super(message);
    this.name = 'BrainExecutionError';
  }
}
