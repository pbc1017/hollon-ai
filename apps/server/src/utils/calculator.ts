/**
 * Calculator utility module
 * Provides basic arithmetic operations
 */

/**
 * Adds two numbers together
 * @param a - First number
 * @param b - Second number
 * @returns The sum of a and b
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Subtracts the second number from the first
 * @param a - Number to subtract from
 * @param b - Number to subtract
 * @returns The difference of a and b
 */
export function subtract(a: number, b: number): number {
  return a - b;
}

/**
 * Multiplies two numbers together
 * @param a - First number
 * @param b - Second number
 * @returns The product of a and b
 */
export function multiply(a: number, b: number): number {
  return a * b;
}

/**
 * Divides the first number by the second
 * @param a - Dividend
 * @param b - Divisor
 * @returns The quotient of a and b
 * @throws Error if divisor is zero
 */
export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero is not allowed');
  }
  return a / b;
}
