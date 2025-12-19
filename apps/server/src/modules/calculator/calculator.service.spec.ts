import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CalculatorService } from './calculator.service';

describe('CalculatorService', () => {
  let service: CalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CalculatorService],
    }).compile();

    service = module.get<CalculatorService>(CalculatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('add', () => {
    it('should add two positive numbers', () => {
      const result = service.add(5, 3);

      expect(result.result).toBe(8);
      expect(result.operation).toBe('add');
      expect(result.operands).toEqual([5, 3]);
      expect(result.timestamp).toBeDefined();
    });

    it('should add two negative numbers', () => {
      const result = service.add(-5, -3);

      expect(result.result).toBe(-8);
      expect(result.operation).toBe('add');
      expect(result.operands).toEqual([-5, -3]);
    });

    it('should add positive and negative numbers', () => {
      const result = service.add(10, -3);

      expect(result.result).toBe(7);
      expect(result.operands).toEqual([10, -3]);
    });

    it('should add decimal numbers', () => {
      const result = service.add(1.5, 2.3);

      expect(result.result).toBeCloseTo(3.8);
      expect(result.operands).toEqual([1.5, 2.3]);
    });

    it('should add zero to a number', () => {
      const result = service.add(5, 0);

      expect(result.result).toBe(5);
    });

    it('should throw error for non-finite first parameter', () => {
      expect(() => service.add(Infinity, 5)).toThrow(BadRequestException);
      expect(() => service.add(Infinity, 5)).toThrow(
        "Parameter 'a' must be a finite number",
      );
    });

    it('should throw error for non-finite second parameter', () => {
      expect(() => service.add(5, NaN)).toThrow(BadRequestException);
      expect(() => service.add(5, NaN)).toThrow(
        "Parameter 'b' must be a finite number",
      );
    });

    it('should throw error for non-number first parameter', () => {
      expect(() => service.add('5' as any, 3)).toThrow(BadRequestException);
      expect(() => service.add('5' as any, 3)).toThrow(
        "Parameter 'a' must be a number",
      );
    });

    it('should throw error for non-number second parameter', () => {
      expect(() => service.add(5, null as any)).toThrow(BadRequestException);
      expect(() => service.add(5, null as any)).toThrow(
        "Parameter 'b' must be a number",
      );
    });

    it('should include timestamp in ISO format', () => {
      const result = service.add(1, 2);
      const timestamp = new Date(result.timestamp);

      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.toISOString()).toBe(result.timestamp);
    });
  });

  describe('subtract', () => {
    it('should subtract two positive numbers', () => {
      const result = service.subtract(10, 3);

      expect(result.result).toBe(7);
      expect(result.operation).toBe('subtract');
      expect(result.operands).toEqual([10, 3]);
      expect(result.timestamp).toBeDefined();
    });

    it('should subtract resulting in negative number', () => {
      const result = service.subtract(3, 10);

      expect(result.result).toBe(-7);
      expect(result.operands).toEqual([3, 10]);
    });

    it('should subtract negative numbers', () => {
      const result = service.subtract(-5, -3);

      expect(result.result).toBe(-2);
      expect(result.operands).toEqual([-5, -3]);
    });

    it('should subtract decimal numbers', () => {
      const result = service.subtract(5.7, 2.3);

      expect(result.result).toBeCloseTo(3.4);
      expect(result.operands).toEqual([5.7, 2.3]);
    });

    it('should subtract zero from a number', () => {
      const result = service.subtract(5, 0);

      expect(result.result).toBe(5);
    });

    it('should subtract a number from zero', () => {
      const result = service.subtract(0, 5);

      expect(result.result).toBe(-5);
    });

    it('should throw error for non-finite first parameter', () => {
      expect(() => service.subtract(Infinity, 5)).toThrow(BadRequestException);
      expect(() => service.subtract(Infinity, 5)).toThrow(
        "Parameter 'a' must be a finite number",
      );
    });

    it('should throw error for non-finite second parameter', () => {
      expect(() => service.subtract(5, -Infinity)).toThrow(BadRequestException);
      expect(() => service.subtract(5, -Infinity)).toThrow(
        "Parameter 'b' must be a finite number",
      );
    });

    it('should throw error for non-number parameters', () => {
      expect(() => service.subtract(undefined as any, 5)).toThrow(
        BadRequestException,
      );
      expect(() => service.subtract(5, {} as any)).toThrow(BadRequestException);
    });
  });

  describe('multiply', () => {
    it('should multiply two positive numbers', () => {
      const result = service.multiply(5, 3);

      expect(result.result).toBe(15);
      expect(result.operation).toBe('multiply');
      expect(result.operands).toEqual([5, 3]);
      expect(result.timestamp).toBeDefined();
    });

    it('should multiply two negative numbers', () => {
      const result = service.multiply(-5, -3);

      expect(result.result).toBe(15);
      expect(result.operands).toEqual([-5, -3]);
    });

    it('should multiply positive and negative numbers', () => {
      const result = service.multiply(5, -3);

      expect(result.result).toBe(-15);
      expect(result.operands).toEqual([5, -3]);
    });

    it('should multiply decimal numbers', () => {
      const result = service.multiply(2.5, 4);

      expect(result.result).toBe(10);
      expect(result.operands).toEqual([2.5, 4]);
    });

    it('should multiply by zero', () => {
      const result = service.multiply(5, 0);

      expect(result.result).toBe(0);
    });

    it('should multiply zero by a number', () => {
      const result = service.multiply(0, 5);

      expect(result.result).toBe(0);
    });

    it('should multiply by one', () => {
      const result = service.multiply(5, 1);

      expect(result.result).toBe(5);
    });

    it('should throw error for non-finite first parameter', () => {
      expect(() => service.multiply(NaN, 5)).toThrow(BadRequestException);
      expect(() => service.multiply(NaN, 5)).toThrow(
        "Parameter 'a' must be a finite number",
      );
    });

    it('should throw error for non-finite second parameter', () => {
      expect(() => service.multiply(5, Infinity)).toThrow(BadRequestException);
      expect(() => service.multiply(5, Infinity)).toThrow(
        "Parameter 'b' must be a finite number",
      );
    });

    it('should throw error for non-number parameters', () => {
      expect(() => service.multiply([] as any, 5)).toThrow(BadRequestException);
      expect(() => service.multiply(5, true as any)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('divide', () => {
    it('should divide two positive numbers', () => {
      const result = service.divide(10, 2);

      expect(result.result).toBe(5);
      expect(result.operation).toBe('divide');
      expect(result.operands).toEqual([10, 2]);
      expect(result.timestamp).toBeDefined();
    });

    it('should divide resulting in decimal', () => {
      const result = service.divide(10, 3);

      expect(result.result).toBeCloseTo(3.333333);
      expect(result.operands).toEqual([10, 3]);
    });

    it('should divide negative numbers', () => {
      const result = service.divide(-10, -2);

      expect(result.result).toBe(5);
      expect(result.operands).toEqual([-10, -2]);
    });

    it('should divide positive by negative', () => {
      const result = service.divide(10, -2);

      expect(result.result).toBe(-5);
      expect(result.operands).toEqual([10, -2]);
    });

    it('should divide decimal numbers', () => {
      const result = service.divide(7.5, 2.5);

      expect(result.result).toBe(3);
      expect(result.operands).toEqual([7.5, 2.5]);
    });

    it('should divide zero by a number', () => {
      const result = service.divide(0, 5);

      expect(result.result).toBe(0);
    });

    it('should throw error when dividing by zero', () => {
      expect(() => service.divide(10, 0)).toThrow(BadRequestException);
      expect(() => service.divide(10, 0)).toThrow(
        'Division by zero is not allowed',
      );
    });

    it('should throw error when dividing negative number by zero', () => {
      expect(() => service.divide(-10, 0)).toThrow(BadRequestException);
      expect(() => service.divide(-10, 0)).toThrow(
        'Division by zero is not allowed',
      );
    });

    it('should throw error when dividing zero by zero', () => {
      expect(() => service.divide(0, 0)).toThrow(BadRequestException);
      expect(() => service.divide(0, 0)).toThrow(
        'Division by zero is not allowed',
      );
    });

    it('should throw error for non-finite first parameter', () => {
      expect(() => service.divide(Infinity, 5)).toThrow(BadRequestException);
      expect(() => service.divide(Infinity, 5)).toThrow(
        "Parameter 'a' must be a finite number",
      );
    });

    it('should throw error for non-finite second parameter', () => {
      expect(() => service.divide(5, NaN)).toThrow(BadRequestException);
      expect(() => service.divide(5, NaN)).toThrow(
        "Parameter 'b' must be a finite number",
      );
    });

    it('should throw error for non-number parameters', () => {
      expect(() => service.divide('10' as any, 2)).toThrow(BadRequestException);
      expect(() => service.divide(10, '2' as any)).toThrow(BadRequestException);
    });

    it('should divide by one', () => {
      const result = service.divide(5, 1);

      expect(result.result).toBe(5);
    });
  });

  describe('timestamp format', () => {
    it('should return consistent timestamp format across all operations', () => {
      const addResult = service.add(1, 2);
      const subtractResult = service.subtract(5, 3);
      const multiplyResult = service.multiply(2, 3);
      const divideResult = service.divide(6, 2);

      expect(addResult.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(subtractResult.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(multiplyResult.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(divideResult.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe('result structure', () => {
    it('should return consistent structure for all operations', () => {
      const result = service.add(1, 2);

      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('operation');
      expect(result).toHaveProperty('operands');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.result).toBe('number');
      expect(typeof result.operation).toBe('string');
      expect(Array.isArray(result.operands)).toBe(true);
      expect(result.operands).toHaveLength(2);
      expect(typeof result.timestamp).toBe('string');
    });
  });
});
