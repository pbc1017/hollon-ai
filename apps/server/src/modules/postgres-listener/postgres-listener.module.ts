import { Module, Global } from '@nestjs/common';
import { PostgresListenerService } from './postgres-listener.service';

@Global()
@Module({
  providers: [PostgresListenerService],
  exports: [PostgresListenerService],
})
export class PostgresListenerModule {}
