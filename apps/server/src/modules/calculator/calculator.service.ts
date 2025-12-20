import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class CalculatorService {
  constructor() {}

  /**
   * Adds two numbers together.
   * @param _a - The first number
   * @param _b - The second number
   * @returns The sum of the two numbers
   */
  add(_a: number, _b: number): number {
    throw new NotImplementedException('Method not implemented');
  }

  /**
   * Subtracts the second number from the first number.
   * @param _a - The number to subtract from
   * @param _b - The number to subtract
   * @returns The difference between the two numbers
   */
  subtract(_a: number, _b: number): number {
    throw new NotImplementedException('Method not implemented');
  }

  /**
   * Multiplies two numbers together.
   * @param _a - The first number
   * @param _b - The second number
   * @returns The product of the two numbers
   */
  multiply(_a: number, _b: number): number {
    throw new NotImplementedException('Method not implemented');
  }

  /**
   * Divides the first number by the second number.
   * @param _a - The dividend (number to be divided)
   * @param _b - The divisor (number to divide by)
   * @returns The quotient of the division
   */
  divide(_a: number, _b: number): number {
    throw new NotImplementedException('Method not implemented');
  }
}
