import { ProcessManagerService } from '../services/process-manager.service';
import { BrainTimeoutError } from '../exceptions/brain-timeout.error';
import { BrainExecutionError } from '../exceptions/brain-execution.error';

describe('ProcessManagerService (Integration)', () => {
  let service: ProcessManagerService;

  beforeEach(() => {
    service = new ProcessManagerService();
  });

  it('should execute echo command successfully', async () => {
    const result = await service.spawn({
      command: 'echo',
      args: ['hello'],
      timeoutMs: 5000,
    });

    expect(result.stdout.trim()).toBe('hello');
    expect(result.exitCode).toBe(0);
    expect(result.duration).toBeGreaterThan(0);
  });

  it('should handle timeout', async () => {
    await expect(
      service.spawn({
        command: 'sleep',
        args: ['10'],
        timeoutMs: 100,
      }),
    ).rejects.toThrow(BrainTimeoutError);
  }, 10000); // Increase Jest timeout for this test

  it('should handle non-existent command', async () => {
    await expect(
      service.spawn({
        command: 'nonexistent_command_xyz',
        args: [],
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(BrainExecutionError);
  });

  it('should pass stdin input', async () => {
    const result = await service.spawn({
      command: 'cat',
      args: [],
      input: 'test input',
      timeoutMs: 5000,
    });

    expect(result.stdout).toBe('test input');
    expect(result.exitCode).toBe(0);
  });

  it('should capture stderr', async () => {
    // Use a command that writes to stderr
    const result = await service.spawn({
      command: 'sh',
      args: ['-c', 'echo "error message" >&2'],
      timeoutMs: 5000,
    });

    expect(result.stderr.trim()).toContain('error message');
    expect(result.exitCode).toBe(0);
  });

  it('should respect working directory', async () => {
    const result = await service.spawn({
      command: 'pwd',
      args: [],
      cwd: '/tmp',
      timeoutMs: 5000,
    });

    // macOS uses /private/tmp
    expect(result.stdout.trim()).toMatch(/\/tmp$/);
  });

  it('should handle non-zero exit codes', async () => {
    const result = await service.spawn({
      command: 'sh',
      args: ['-c', 'exit 42'],
      timeoutMs: 5000,
    });

    expect(result.exitCode).toBe(42);
  });
});
