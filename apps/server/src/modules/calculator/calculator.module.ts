import { Module } from '@nestjs/common';
import { CalculatorService } from './calculator.service';

@Module({
  providers: [CalculatorService],
})
export class CalculatorModule {}
