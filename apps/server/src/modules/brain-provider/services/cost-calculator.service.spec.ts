import { CostCalculatorService } from '../services/cost-calculator.service';

describe('CostCalculatorService', () => {
  let service: CostCalculatorService;

  beforeEach(() => {
    service = new CostCalculatorService();
  });

  describe('estimateCost', () => {
    it('should estimate tokens from character count (1000 chars → ~250 tokens)', () => {
      const result = service.estimateCost('a'.repeat(1000), '', {
        costPerInputTokenCents: 300,
        costPerOutputTokenCents: 1500,
      });

      // 1000 chars / 4 = 250 tokens
      expect(result.inputTokens).toBe(250);
    });

    it('should calculate cost correctly', () => {
      const result = service.estimateCost('test', '', {
        costPerInputTokenCents: 300, // $3 per 1M tokens = 300 cents
        costPerOutputTokenCents: 1500, // $15 per 1M tokens = 1500 cents
      });

      expect(result.totalCostCents).toBeGreaterThan(0);
      expect(typeof result.totalCostCents).toBe('number');
    });

    it('should estimate output tokens as 50% of input', () => {
      const result = service.estimateCost('a'.repeat(1000), '', {
        costPerInputTokenCents: 300,
        costPerOutputTokenCents: 1500,
      });

      expect(result.outputTokens).toBe(Math.ceil(result.inputTokens * 0.5));
    });

    it('should include system prompt in token calculation', () => {
      const resultWithSystem = service.estimateCost(
        'a'.repeat(1000),
        'b'.repeat(1000),
        {
          costPerInputTokenCents: 300,
          costPerOutputTokenCents: 1500,
        },
      );

      const resultWithoutSystem = service.estimateCost('a'.repeat(1000), '', {
        costPerInputTokenCents: 300,
        costPerOutputTokenCents: 1500,
      });

      expect(resultWithSystem.inputTokens).toBe(
        resultWithoutSystem.inputTokens * 2,
      );
    });
  });

  describe('calculateFromActual', () => {
    it('should calculate exact cost from actual token counts', () => {
      const result = service.calculateFromActual(1000, 500, {
        costPerInputTokenCents: 300, // $3 per 1M = 300 cents
        costPerOutputTokenCents: 1500, // $15 per 1M = 1500 cents
      });

      // (1000 / 1,000,000) * 300 + (500 / 1,000,000) * 1500 = 0.3 + 0.75 = 1.05 cents
      expect(result.inputTokens).toBe(1000);
      expect(result.outputTokens).toBe(500);
      expect(result.totalCostCents).toBeCloseTo(1.05, 6);
    });

    it('should handle zero tokens', () => {
      const result = service.calculateFromActual(0, 0, {
        costPerInputTokenCents: 300,
        costPerOutputTokenCents: 1500,
      });

      expect(result.totalCostCents).toBe(0);
    });

    it('should handle large token counts', () => {
      const result = service.calculateFromActual(100000, 50000, {
        costPerInputTokenCents: 300,
        costPerOutputTokenCents: 1500,
      });

      // (100000 / 1,000,000) * 300 + (50000 / 1,000,000) * 1500 = 30 + 75 = 105 cents
      expect(result.totalCostCents).toBeCloseTo(105, 6);
    });
  });
});
