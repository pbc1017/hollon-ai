import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import {
  IProcessManager,
  ProcessOptions,
  ProcessResult,
} from '../interfaces/process-manager.interface';
import { BrainTimeoutError } from '../exceptions/brain-timeout.error';
import { BrainExecutionError } from '../exceptions/brain-execution.error';

@Injectable()
export class ProcessManagerService implements IProcessManager {
  private readonly logger = new Logger(ProcessManagerService.name);
  private readonly runningProcesses: Map<number, ChildProcess> = new Map();

  async spawn(options: ProcessOptions): Promise<ProcessResult> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Fix #11: Fail if cwd is provided but doesn't exist (no fallback to process.cwd())
      // This prevents Brain Provider from accidentally running in main repo
      if (options.cwd && !existsSync(options.cwd)) {
        reject(
          new BrainExecutionError(
            `Fix #11: Working directory does not exist: ${options.cwd}. This prevents main repo pollution.`,
            `CWD not found: ${options.cwd}`,
          ),
        );
        return;
      }

      const cwd = options.cwd || process.cwd();

      // Enhanced debug logging for ENOENT diagnosis
      this.logger.debug(`[SPAWN DEBUG] Command: "${options.command}"`);
      this.logger.debug(`[SPAWN DEBUG] Args: ${JSON.stringify(options.args)}`);
      this.logger.debug(`[SPAWN DEBUG] CWD: "${cwd}"`);
      this.logger.debug(
        `[SPAWN DEBUG] Full command: ${options.command} ${options.args.join(' ')}`,
      );

      // Check if command exists (for ENOENT debugging)
      const commandExists = existsSync(options.command);
      this.logger.debug(`[SPAWN DEBUG] Command path exists: ${commandExists}`);

      const cwdExists = existsSync(cwd);
      this.logger.debug(`[SPAWN DEBUG] CWD path exists: ${cwdExists}`);

      // Spawn the process
      const proc = spawn(options.command, options.args, {
        cwd,
        env: process.env,
        // Explicit stdio configuration to prevent Claude Code Ink framework issues
        // 'pipe' allows us to capture stdout/stderr while preventing TTY detection errors
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.logger.debug(`[SPAWN DEBUG] Process spawned with PID: ${proc.pid}`);

      // Track running process for emergency stop
      if (proc.pid) {
        this.runningProcesses.set(proc.pid, proc);
        this.logger.debug(
          `[PROCESS TRACKING] Added process ${proc.pid} (total: ${this.runningProcesses.size})`,
        );
      }

      // Timeout handler
      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        const duration = Date.now() - startTime;
        this.logger.warn(
          `Process timeout after ${options.timeoutMs}ms (actual: ${duration}ms)`,
        );

        // Try graceful shutdown first
        proc.kill('SIGTERM');

        // Force kill after 5s grace period
        setTimeout(() => {
          if (!proc.killed) {
            this.logger.warn('Force killing process with SIGKILL');
            proc.kill('SIGKILL');
          }
        }, 5000);
      }, options.timeoutMs);

      // Collect stdout
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Collect stderr
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      proc.on('close', (code) => {
        clearTimeout(timeoutHandle);
        const duration = Date.now() - startTime;

        // Remove from tracking
        if (proc.pid) {
          this.runningProcesses.delete(proc.pid);
          this.logger.debug(
            `[PROCESS TRACKING] Removed process ${proc.pid} (remaining: ${this.runningProcesses.size})`,
          );
        }

        if (timedOut) {
          reject(new BrainTimeoutError(options.timeoutMs, duration));
        } else {
          this.logger.debug(
            `Process completed: code=${code}, duration=${duration}ms`,
          );
          resolve({
            stdout,
            stderr,
            exitCode: code || 0,
            duration,
          });
        }
      });

      // Handle spawn errors (command not found, etc.)
      proc.on('error', (err: Error & { code?: string }) => {
        clearTimeout(timeoutHandle);
        const duration = Date.now() - startTime;

        // Remove from tracking
        if (proc.pid) {
          this.runningProcesses.delete(proc.pid);
          this.logger.debug(
            `[PROCESS TRACKING] Removed process ${proc.pid} on error (remaining: ${this.runningProcesses.size})`,
          );
        }

        // Enhanced error logging for ENOENT
        this.logger.error(`[SPAWN ERROR] Error code: ${err.code}`);
        this.logger.error(`[SPAWN ERROR] Error message: ${err.message}`);
        this.logger.error(`[SPAWN ERROR] Command: "${options.command}"`);
        this.logger.error(
          `[SPAWN ERROR] Args: ${JSON.stringify(options.args)}`,
        );
        this.logger.error(`[SPAWN ERROR] CWD: "${cwd}"`);
        this.logger.error(`[SPAWN ERROR] Duration: ${duration}ms`);

        if (err.code === 'ENOENT') {
          this.logger.error(
            `[SPAWN ERROR] ENOENT - File not found. Check if command path is correct and executable exists.`,
          );
        }

        reject(
          new BrainExecutionError(
            `Failed to spawn process: ${err.message} (code: ${err.code})`,
            err.message,
          ),
        );
      });

      // Send input to stdin if provided
      if (options.input) {
        proc.stdin.write(options.input);
        proc.stdin.end();
      }
    });
  }

  /**
   * Kill all running processes
   * Used for emergency stop functionality
   */
  killAll(): { killed: number; pids: number[] } {
    const killed: number[] = [];

    this.logger.warn(
      `[EMERGENCY STOP] Killing all running processes (${this.runningProcesses.size} processes)`,
    );

    for (const [pid, proc] of this.runningProcesses.entries()) {
      try {
        // Try graceful shutdown first
        proc.kill('SIGTERM');
        killed.push(pid);
        this.logger.warn(`[EMERGENCY STOP] Sent SIGTERM to process ${pid}`);

        // Force kill after 2s if still alive
        setTimeout(() => {
          if (!proc.killed) {
            this.logger.warn(
              `[EMERGENCY STOP] Force killing process ${pid} with SIGKILL`,
            );
            proc.kill('SIGKILL');
          }
        }, 2000);
      } catch (error) {
        this.logger.error(
          `[EMERGENCY STOP] Failed to kill process ${pid}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // Clear the map (processes will be removed by close handler too)
    this.runningProcesses.clear();

    this.logger.warn(
      `[EMERGENCY STOP] Kill signal sent to ${killed.length} processes`,
    );

    return {
      killed: killed.length,
      pids: killed,
    };
  }

  /**
   * Get count of currently running processes
   */
  getRunningProcessCount(): number {
    return this.runningProcesses.size;
  }
}
