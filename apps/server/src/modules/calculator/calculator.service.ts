import { Injectable } from '@nestjs/common';

@Injectable()
export class CalculatorService {
  constructor() {}

  add(_a: number, _b: number): number {
    throw new Error('Method not implemented.');
  }

  subtract(_a: number, _b: number): number {
    throw new Error('Method not implemented.');
  }

  multiply(_a: number, _b: number): number {
    throw new Error('Method not implemented.');
  }

  divide(_a: number, _b: number): number {
    throw new Error('Method not implemented.');
  }
}
