import { Injectable } from '@nestjs/common';

interface PricingConfig {
  costPerInputTokenCents: number;
  costPerOutputTokenCents: number;
}

interface CostResult {
  inputTokens: number;
  outputTokens: number;
  totalCostCents: number;
}

@Injectable()
export class CostCalculatorService {
  // Rough approximation: 4 characters ≈ 1 token
  private readonly CHARS_PER_TOKEN = 4;
  private readonly OUTPUT_TOKEN_RATIO = 0.5; // Output is ~50% of input

  /**
   * Estimate cost before execution based on prompt length
   */
  estimateCost(
    prompt: string,
    systemPrompt: string = '',
    pricing: PricingConfig,
  ): CostResult {
    const totalChars = prompt.length + systemPrompt.length;
    const inputTokens = Math.ceil(totalChars / this.CHARS_PER_TOKEN);
    const outputTokens = Math.ceil(inputTokens * this.OUTPUT_TOKEN_RATIO);

    return this.calculateFromActual(inputTokens, outputTokens, pricing);
  }

  /**
   * Calculate exact cost from actual token counts
   * Pricing is in cents per million tokens
   */
  calculateFromActual(
    inputTokens: number,
    outputTokens: number,
    pricing: PricingConfig,
  ): CostResult {
    // pricing.costPerInputTokenCents is cents per 1M tokens
    // So for N tokens: (N / 1_000_000) * costPerInputTokenCents
    const inputCostCents =
      (inputTokens / 1_000_000) * pricing.costPerInputTokenCents;
    const outputCostCents =
      (outputTokens / 1_000_000) * pricing.costPerOutputTokenCents;

    return {
      inputTokens,
      outputTokens,
      totalCostCents: Number((inputCostCents + outputCostCents).toFixed(6)),
    };
  }
}
