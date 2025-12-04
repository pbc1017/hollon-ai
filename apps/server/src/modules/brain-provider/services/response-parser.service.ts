import { Injectable } from '@nestjs/common';

interface ParseResult {
  output: string;
  metadata?: Record<string, unknown>;
  hasError: boolean;
  errorMessage?: string;
}

@Injectable()
export class ResponseParserService {
  /**
   * Parse raw CLI output
   * - Attempts to parse as JSON if possible
   * - Detects error messages
   * - Trims whitespace
   */
  parse(rawOutput: string): ParseResult {
    const trimmed = rawOutput.trim();

    // Try to parse as JSON
    let metadata: Record<string, unknown> | undefined;
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null) {
        metadata = parsed;
      }
    } catch {
      // Not JSON, treat as plain text
    }

    // Detect errors (must be at the start of the line)
    const hasError =
      /^Error:/i.test(trimmed) || /^Fatal:/i.test(trimmed);
    const errorMessage = hasError ? trimmed : undefined;

    return {
      output: trimmed,
      metadata,
      hasError,
      errorMessage,
    };
  }
}
