import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Cycle, CycleStatus } from './entities/cycle.entity';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { UpdateCycleDto } from './dto/update-cycle.dto';

@Injectable()
export class CycleService {
  constructor(
    @InjectRepository(Cycle)
    private readonly cycleRepo: Repository<Cycle>,
  ) {}

  /**
   * Create a new cycle
   */
  async create(dto: CreateCycleDto): Promise<Cycle> {
    const cycle = this.cycleRepo.create(dto);
    return this.cycleRepo.save(cycle);
  }

  /**
   * Find all cycles for a project
   */
  async findByProject(projectId: string): Promise<Cycle[]> {
    return this.cycleRepo.find({
      where: { projectId },
      order: { number: 'DESC' },
    });
  }

  /**
   * Find active cycles
   */
  async findActive(): Promise<Cycle[]> {
    return this.cycleRepo.find({
      where: { status: CycleStatus.ACTIVE },
      relations: ['project'],
    });
  }

  /**
   * Find cycles completed in a date range
   */
  async findCompletedInRange(startDate: Date, endDate: Date): Promise<Cycle[]> {
    return this.cycleRepo.find({
      where: {
        status: CycleStatus.COMPLETED,
        completedAt: Between(startDate, endDate) as any,
      },
      relations: ['project'],
    });
  }

  /**
   * Find one cycle by ID
   */
  async findOne(id: string): Promise<Cycle | null> {
    return this.cycleRepo.findOne({
      where: { id },
      relations: ['project', 'tasks'],
    });
  }

  /**
   * Update a cycle
   */
  async update(id: string, dto: UpdateCycleDto): Promise<Cycle> {
    const cycle = await this.findOne(id);
    if (!cycle) {
      throw new NotFoundException(`Cycle with ID ${id} not found`);
    }

    Object.assign(cycle, dto);

    // If marking as completed, set completedAt
    if (dto.status === CycleStatus.COMPLETED && !cycle.completedAt) {
      cycle.completedAt = new Date();
    }

    return this.cycleRepo.save(cycle);
  }

  /**
   * Delete a cycle
   */
  async remove(id: string): Promise<void> {
    const result = await this.cycleRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Cycle with ID ${id} not found`);
    }
  }

  /**
   * Get current active cycle for a project
   */
  async getCurrentCycle(projectId: string): Promise<Cycle | null> {
    return this.cycleRepo.findOne({
      where: { projectId, status: CycleStatus.ACTIVE },
      order: { number: 'DESC' },
    });
  }

  /**
   * Get next cycle number for a project
   */
  async getNextCycleNumber(projectId: string): Promise<number> {
    const lastCycle = await this.cycleRepo.findOne({
      where: { projectId },
      order: { number: 'DESC' },
    });

    return lastCycle ? lastCycle.number + 1 : 1;
  }

  /**
   * Create next cycle automatically
   */
  async createNextCycle(
    projectId: string,
    durationDays: number = 7,
  ): Promise<Cycle> {
    const number = await this.getNextCycleNumber(projectId);
    const currentCycle = await this.getCurrentCycle(projectId);

    // Calculate dates
    const startDate = currentCycle
      ? new Date(currentCycle.endDate)
      : new Date();
    startDate.setDate(startDate.getDate() + 1); // Start day after previous cycle ends

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays - 1);

    return this.create({
      projectId,
      number,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      name: `Cycle ${number}`,
    });
  }
}
