export class ClaudeCodeNotFoundError extends Error {
  constructor(public readonly cliPath: string) {
    super(
      `Claude Code CLI not found at: ${cliPath}\n` +
        `Please ensure Claude Code is installed and accessible.\n` +
        `Set CLAUDE_CODE_PATH environment variable if needed.`,
    );
    this.name = 'ClaudeCodeNotFoundError';
  }
}
