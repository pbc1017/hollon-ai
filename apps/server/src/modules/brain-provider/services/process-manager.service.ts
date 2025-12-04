import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
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

  async spawn(options: ProcessOptions): Promise<ProcessResult> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      this.logger.debug(
        `Spawning: ${options.command} ${options.args.join(' ')}`,
      );

      // Spawn the process
      const proc = spawn(options.command, options.args, {
        cwd: options.cwd || process.cwd(),
        env: process.env,
      });

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
      proc.on('error', (err) => {
        clearTimeout(timeoutHandle);
        const duration = Date.now() - startTime;
        this.logger.error(
          `Process spawn error: ${err.message}, duration=${duration}ms`,
        );
        reject(
          new BrainExecutionError(
            `Failed to spawn process: ${err.message}`,
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
}
