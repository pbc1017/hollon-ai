export interface ProcessOptions {
  command: string;
  args: string[];
  input?: string;
  cwd?: string;
  timeoutMs: number;
}

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface IProcessManager {
  spawn(options: ProcessOptions): Promise<ProcessResult>;
}
