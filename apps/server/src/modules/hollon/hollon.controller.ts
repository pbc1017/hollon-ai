import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { HollonService } from './hollon.service';
import { CreateHollonDto } from './dto/create-hollon.dto';
import { UpdateHollonDto } from './dto/update-hollon.dto';
import { HollonStatus } from './entities/hollon.entity';

@Controller('hollons')
export class HollonController {
  constructor(private readonly hollonService: HollonService) {}

  @Post()
  create(@Body() dto: CreateHollonDto) {
    return this.hollonService.create(dto);
  }

  @Get()
  findAll(
    @Query('organizationId') organizationId?: string,
    @Query('teamId') teamId?: string,
    @Query('status') status?: HollonStatus,
  ) {
    return this.hollonService.findAll({ organizationId, teamId, status });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.hollonService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateHollonDto) {
    return this.hollonService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: HollonStatus,
  ) {
    return this.hollonService.updateStatus(id, status);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.hollonService.remove(id);
  }
}
