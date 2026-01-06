import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incident } from './entities/incident.entity';
import { Hollon } from '../hollon/entities/hollon.entity';
import { Task } from '../task/entities/task.entity';
import { IncidentResponseService } from './services/incident-response.service';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [TypeOrmModule.forFeature([Incident, Hollon, Task]), MessageModule],
  providers: [IncidentResponseService],
  exports: [IncidentResponseService],
})
export class IncidentModule {}
