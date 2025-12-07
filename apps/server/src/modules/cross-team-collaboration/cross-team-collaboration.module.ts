import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrossTeamContract } from './entities/cross-team-contract.entity';
import { CrossTeamCollaborationService } from './services/cross-team-collaboration.service';

@Module({
  imports: [TypeOrmModule.forFeature([CrossTeamContract])],
  providers: [CrossTeamCollaborationService],
  exports: [CrossTeamCollaborationService],
})
export class CrossTeamCollaborationModule {}
