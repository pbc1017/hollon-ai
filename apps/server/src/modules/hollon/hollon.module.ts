import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hollon } from './entities/hollon.entity';
import { HollonService } from './hollon.service';
import { HollonController } from './hollon.controller';
import { ApprovalModule } from '../approval/approval.module';
import { RoleModule } from '../role/role.module';
import { TeamModule } from '../team/team.module';
import { OrganizationModule } from '../organization/organization.module';
import { Team } from '../team/entities/team.entity';
import { Role } from '../role/entities/role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Hollon, Team, Role]),
    ApprovalModule,
    RoleModule,
    forwardRef(() => TeamModule),
    OrganizationModule,
  ],
  controllers: [HollonController],
  providers: [HollonService],
  exports: [HollonService],
})
export class HollonModule {}
