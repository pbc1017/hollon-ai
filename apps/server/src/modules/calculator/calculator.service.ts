import { Injectable, BadRequestException } from '@nestjs/common';

export interface CalculationResult {
  result: number;
  operation: string;
  operands: number[];
  timestamp: string;
}

@Injectable()
export class CalculatorService {
  /**
   * Add two numbers
   */
  add(a: number, b: number): CalculationResult {
    this.validateNumber(a, 'a');
    this.validateNumber(b, 'b');

    return {
      result: a + b,
      operation: 'add',
      operands: [a, b],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Subtract b from a
   */
  subtract(a: number, b: number): CalculationResult {
    this.validateNumber(a, 'a');
    this.validateNumber(b, 'b');

    return {
      result: a - b,
      operation: 'subtract',
      operands: [a, b],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Multiply two numbers
   */
  multiply(a: number, b: number): CalculationResult {
    this.validateNumber(a, 'a');
    this.validateNumber(b, 'b');

    return {
      result: a * b,
      operation: 'multiply',
      operands: [a, b],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Divide a by b
   */
  divide(a: number, b: number): CalculationResult {
    this.validateNumber(a, 'a');
    this.validateNumber(b, 'b');

    if (b === 0) {
      throw new BadRequestException('Division by zero is not allowed');
    }

    return {
      result: a / b,
      operation: 'divide',
      operands: [a, b],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validate that a value is a valid number
   */
  private validateNumber(value: number, paramName: string): void {
    if (typeof value !== 'number') {
      throw new BadRequestException(
        `Parameter '${paramName}' must be a number`,
      );
    }

    if (!Number.isFinite(value)) {
      throw new BadRequestException(
        `Parameter '${paramName}' must be a finite number`,
      );
    }
  }
}
