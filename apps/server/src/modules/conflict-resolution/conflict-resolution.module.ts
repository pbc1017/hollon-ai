import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConflictResolution } from './entities/conflict-resolution.entity';
import { Task } from '../task/entities/task.entity';
import { ConflictResolutionService } from './services/conflict-resolution.service';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConflictResolution, Task]),
    MessageModule,
  ],
  providers: [ConflictResolutionService],
  exports: [ConflictResolutionService],
})
export class ConflictResolutionModule {}
