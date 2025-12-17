import { Test, TestingModule } from '@nestjs/testing';
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
    it('should add two positive numbers correctly', () => {
      expect(service.add(2, 3)).toBe(5);
    });

    it('should add two negative numbers correctly', () => {
      expect(service.add(-2, -3)).toBe(-5);
    });

    it('should add a positive and negative number correctly', () => {
      expect(service.add(5, -3)).toBe(2);
    });

    it('should add zero correctly', () => {
      expect(service.add(0, 5)).toBe(5);
      expect(service.add(5, 0)).toBe(5);
    });

    it('should add decimal numbers correctly', () => {
      expect(service.add(1.5, 2.5)).toBe(4);
    });

    it('should throw error when first parameter is null', () => {
      expect(() => service.add(null as any, 5)).toThrow(
        'First parameter cannot be null or undefined',
      );
    });

    it('should throw error when first parameter is undefined', () => {
      expect(() => service.add(undefined as any, 5)).toThrow(
        'First parameter cannot be null or undefined',
      );
    });

    it('should throw error when second parameter is null', () => {
      expect(() => service.add(5, null as any)).toThrow(
        'Second parameter cannot be null or undefined',
      );
    });

    it('should throw error when second parameter is undefined', () => {
      expect(() => service.add(5, undefined as any)).toThrow(
        'Second parameter cannot be null or undefined',
      );
    });

    it('should throw error when first parameter is NaN', () => {
      expect(() => service.add(NaN, 5)).toThrow(
        'First parameter must be a valid number',
      );
    });

    it('should throw error when second parameter is NaN', () => {
      expect(() => service.add(5, NaN)).toThrow(
        'Second parameter must be a valid number',
      );
    });

    it('should throw error when first parameter is not a number', () => {
      expect(() => service.add('5' as any, 3)).toThrow(
        'First parameter must be a valid number',
      );
    });

    it('should throw error when second parameter is not a number', () => {
      expect(() => service.add(5, '3' as any)).toThrow(
        'Second parameter must be a valid number',
      );
    });
  });

  describe('subtract', () => {
    it('should subtract two positive numbers correctly', () => {
      expect(service.subtract(5, 3)).toBe(2);
    });

    it('should subtract two negative numbers correctly', () => {
      expect(service.subtract(-2, -3)).toBe(1);
    });

    it('should subtract a negative from a positive number correctly', () => {
      expect(service.subtract(5, -3)).toBe(8);
    });

    it('should subtract zero correctly', () => {
      expect(service.subtract(5, 0)).toBe(5);
      expect(service.subtract(0, 5)).toBe(-5);
    });

    it('should subtract decimal numbers correctly', () => {
      expect(service.subtract(5.5, 2.5)).toBe(3);
    });

    it('should throw error when first parameter is null', () => {
      expect(() => service.subtract(null as any, 5)).toThrow(
        'First parameter cannot be null or undefined',
      );
    });

    it('should throw error when first parameter is undefined', () => {
      expect(() => service.subtract(undefined as any, 5)).toThrow(
        'First parameter cannot be null or undefined',
      );
    });

    it('should throw error when second parameter is null', () => {
      expect(() => service.subtract(5, null as any)).toThrow(
        'Second parameter cannot be null or undefined',
      );
    });

    it('should throw error when second parameter is undefined', () => {
      expect(() => service.subtract(5, undefined as any)).toThrow(
        'Second parameter cannot be null or undefined',
      );
    });

    it('should throw error when first parameter is NaN', () => {
      expect(() => service.subtract(NaN, 5)).toThrow(
        'First parameter must be a valid number',
      );
    });

    it('should throw error when second parameter is NaN', () => {
      expect(() => service.subtract(5, NaN)).toThrow(
        'Second parameter must be a valid number',
      );
    });

    it('should throw error when first parameter is not a number', () => {
      expect(() => service.subtract('5' as any, 3)).toThrow(
        'First parameter must be a valid number',
      );
    });

    it('should throw error when second parameter is not a number', () => {
      expect(() => service.subtract(5, '3' as any)).toThrow(
        'Second parameter must be a valid number',
      );
    });
  });

  describe('multiply', () => {
    it('should multiply two positive numbers correctly', () => {
      expect(service.multiply(2, 3)).toBe(6);
    });

    it('should multiply two negative numbers correctly', () => {
      expect(service.multiply(-2, -3)).toBe(6);
    });

    it('should multiply a positive and negative number correctly', () => {
      expect(service.multiply(5, -3)).toBe(-15);
    });

    it('should multiply by zero correctly', () => {
      expect(service.multiply(0, 5)).toBe(0);
      expect(service.multiply(5, 0)).toBe(0);
    });

    it('should multiply decimal numbers correctly', () => {
      expect(service.multiply(1.5, 2)).toBe(3);
    });

    it('should throw error when first parameter is null', () => {
      expect(() => service.multiply(null as any, 5)).toThrow(
        'First parameter cannot be null or undefined',
      );
    });

    it('should throw error when first parameter is undefined', () => {
      expect(() => service.multiply(undefined as any, 5)).toThrow(
        'First parameter cannot be null or undefined',
      );
    });

    it('should throw error when second parameter is null', () => {
      expect(() => service.multiply(5, null as any)).toThrow(
        'Second parameter cannot be null or undefined',
      );
    });

    it('should throw error when second parameter is undefined', () => {
      expect(() => service.multiply(5, undefined as any)).toThrow(
        'Second parameter cannot be null or undefined',
      );
    });

    it('should throw error when first parameter is NaN', () => {
      expect(() => service.multiply(NaN, 5)).toThrow(
        'First parameter must be a valid number',
      );
    });

    it('should throw error when second parameter is NaN', () => {
      expect(() => service.multiply(5, NaN)).toThrow(
        'Second parameter must be a valid number',
      );
    });

    it('should throw error when first parameter is not a number', () => {
      expect(() => service.multiply('5' as any, 3)).toThrow(
        'First parameter must be a valid number',
      );
    });

    it('should throw error when second parameter is not a number', () => {
      expect(() => service.multiply(5, '3' as any)).toThrow(
        'Second parameter must be a valid number',
      );
    });
  });

  describe('divide', () => {
    it('should divide two positive numbers correctly', () => {
      expect(service.divide(6, 3)).toBe(2);
    });

    it('should divide two negative numbers correctly', () => {
      expect(service.divide(-6, -3)).toBe(2);
    });

    it('should divide a positive by a negative number correctly', () => {
      expect(service.divide(6, -3)).toBe(-2);
    });

    it('should divide a negative by a positive number correctly', () => {
      expect(service.divide(-6, 3)).toBe(-2);
    });

    it('should divide zero by a number correctly', () => {
      expect(service.divide(0, 5)).toBe(0);
    });

    it('should divide decimal numbers correctly', () => {
      expect(service.divide(5, 2)).toBe(2.5);
    });

    it('should throw error when dividing by zero', () => {
      expect(() => service.divide(5, 0)).toThrow('Cannot divide by zero');
    });

    it('should throw error when first parameter is null', () => {
      expect(() => service.divide(null as any, 5)).toThrow(
        'First parameter cannot be null or undefined',
      );
    });

    it('should throw error when first parameter is undefined', () => {
      expect(() => service.divide(undefined as any, 5)).toThrow(
        'First parameter cannot be null or undefined',
      );
    });

    it('should throw error when second parameter is null', () => {
      expect(() => service.divide(5, null as any)).toThrow(
        'Second parameter cannot be null or undefined',
      );
    });

    it('should throw error when second parameter is undefined', () => {
      expect(() => service.divide(5, undefined as any)).toThrow(
        'Second parameter cannot be null or undefined',
      );
    });

    it('should throw error when first parameter is NaN', () => {
      expect(() => service.divide(NaN, 5)).toThrow(
        'First parameter must be a valid number',
      );
    });

    it('should throw error when second parameter is NaN', () => {
      expect(() => service.divide(5, NaN)).toThrow(
        'Second parameter must be a valid number',
      );
    });

    it('should throw error when first parameter is not a number', () => {
      expect(() => service.divide('5' as any, 3)).toThrow(
        'First parameter must be a valid number',
      );
    });

    it('should throw error when second parameter is not a number', () => {
      expect(() => service.divide(5, '3' as any)).toThrow(
        'Second parameter must be a valid number',
      );
    });
  });
});
