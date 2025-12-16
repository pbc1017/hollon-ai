import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hollon } from './entities/hollon.entity';
import { HollonService } from './hollon.service';
import { HollonController } from './hollon.controller';
import { HollonCleanupListener } from './listeners/hollon-cleanup.listener';
import { ApprovalModule } from '../approval/approval.module';
import { RoleModule } from '../role/role.module';
import { TeamModule } from '../team/team.module';
import { OrganizationModule } from '../organization/organization.module';
import { OrchestrationModule } from '../orchestration/orchestration.module';
import { BrainProviderModule } from '../brain-provider/brain-provider.module';
import { Team } from '../team/entities/team.entity';
import { Role } from '../role/entities/role.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Task } from '../task/entities/task.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Hollon, Team, Role, Organization, Task]),
    ApprovalModule,
    RoleModule,
    forwardRef(() => TeamModule),
    OrganizationModule,
    forwardRef(() => OrchestrationModule),
    BrainProviderModule,
  ],
  controllers: [HollonController],
  providers: [HollonService, HollonCleanupListener],
  exports: [HollonService],
})
export class HollonModule {}
