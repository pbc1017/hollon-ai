import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hollon } from './entities/hollon.entity';
import { HollonService } from './hollon.service';
import { HollonController } from './hollon.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Hollon])],
  controllers: [HollonController],
  providers: [HollonService],
  exports: [HollonService],
})
export class HollonModule {}
