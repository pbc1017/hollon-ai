import { Injectable } from '@nestjs/common';

@Injectable()
export class CalculatorService {
  getHello(): string {
    return 'Hello from Calculator Service!';
  }

  /**
   * Validates that a value is a valid number (not NaN, null, or undefined)
   * @param value - The value to validate
   * @param paramName - The parameter name for error messages
   * @throws Error if the value is invalid
   */
  private validateNumber(value: any, paramName: string): void {
    if (value === null || value === undefined) {
      throw new Error(`${paramName} cannot be null or undefined`);
    }
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`${paramName} must be a valid number`);
    }
  }

  /**
   * Adds two numbers together
   * @param a - The first number
   * @param b - The second number
   * @returns The sum of a and b
   * @throws Error if either input is not a valid number
   */
  add(a: number, b: number): number {
    this.validateNumber(a, 'First parameter');
    this.validateNumber(b, 'Second parameter');
    return a + b;
  }

  /**
   * Subtracts the second number from the first
   * @param a - The number to subtract from
   * @param b - The number to subtract
   * @returns The difference of a minus b
   * @throws Error if either input is not a valid number
   */
  subtract(a: number, b: number): number {
    this.validateNumber(a, 'First parameter');
    this.validateNumber(b, 'Second parameter');
    return a - b;
  }
}
