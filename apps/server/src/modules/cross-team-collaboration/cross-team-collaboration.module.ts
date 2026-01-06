import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrossTeamContract } from './entities/cross-team-contract.entity';
import { CrossTeamCollaborationService } from './services/cross-team-collaboration.service';
import { MessageModule } from '../message/message.module';
import { Hollon } from '../hollon/entities/hollon.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CrossTeamContract, Hollon]),
    MessageModule,
  ],
  providers: [CrossTeamCollaborationService],
  exports: [CrossTeamCollaborationService],
})
export class CrossTeamCollaborationModule {}
