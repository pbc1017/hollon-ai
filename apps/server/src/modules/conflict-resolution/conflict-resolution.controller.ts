import { Controller, Get, Post, Put, Param, Body, Query } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObject = Record<string, any>;

@Controller('conflict-resolution')
export class ConflictResolutionController {
  constructor() {}

  @Post('conflicts')
  async createConflict(@Body() createDto: AnyObject) {
    // Stub implementation - returns mock data
    return {
      id: 'mock-conflict-id',
      ...createDto,
      status: 'detected',
      createdAt: new Date(),
    };
  }

  @Get('conflicts')
  async findConflicts(@Query() _query: AnyObject) {
    // Stub implementation - returns empty array
    return [];
  }

  @Get('conflicts/:id')
  async getConflict(@Param('id') id: string) {
    // Stub implementation - returns mock data
    return {
      id,
      status: 'resolved',
      strategy: 'sequential_execution',
      createdAt: new Date(),
      resolvedAt: new Date(),
    };
  }

  @Put('conflicts/:id')
  async updateConflict(@Param('id') id: string, @Body() updateDto: AnyObject) {
    // Stub implementation
    return {
      id,
      ...updateDto,
      updatedAt: new Date(),
    };
  }

  @Post('conflicts/:id/resolve')
  async resolveConflict(
    @Param('id') id: string,
    @Body() resolveDto: AnyObject,
  ) {
    // Stub implementation
    return {
      id,
      status: 'resolved',
      ...resolveDto,
      resolvedAt: new Date(),
    };
  }
}
