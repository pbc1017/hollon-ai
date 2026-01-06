import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { PostgresListenerModule } from '../postgres-listener/postgres-listener.module';
import { WsAuthGuard } from './guards/ws-auth.guard';

@Module({
  imports: [PostgresListenerModule],
  providers: [RealtimeGateway, WsAuthGuard],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
