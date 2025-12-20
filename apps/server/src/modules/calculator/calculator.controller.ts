import { Controller, Get, Query } from '@nestjs/common';
import { CalculatorService } from './calculator.service';

@Controller('calculator')
export class CalculatorController {
  constructor(private readonly calculatorService: CalculatorService) {}

  @Get('add')
  add(@Query('a') a: string, @Query('b') b: string): number {
    return this.calculatorService.add(Number(a), Number(b));
  }

  @Get('subtract')
  subtract(@Query('a') a: string, @Query('b') b: string): number {
    return this.calculatorService.subtract(Number(a), Number(b));
  }

  @Get('multiply')
  multiply(@Query('a') a: string, @Query('b') b: string): number {
    return this.calculatorService.multiply(Number(a), Number(b));
  }

  @Get('divide')
  divide(@Query('a') a: string, @Query('b') b: string): number {
    return this.calculatorService.divide(Number(a), Number(b));
  }
}
