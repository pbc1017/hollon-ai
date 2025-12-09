import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isProduction = configService.get('nodeEnv') === 'production';
  const isTest = configService.get('nodeEnv') === 'test';

  return {
    type: 'postgres',
    host: configService.get<string>('database.host'),
    port: configService.get<number>('database.port'),
    username: configService.get<string>('database.user'),
    password: configService.get<string>('database.password'),
    database: configService.get<string>('database.name'),
    schema: configService.get<string>('database.schema', 'hollon'),
    entities: [__dirname + '/../**/*.entity.{ts,js}'],
    migrations: [__dirname + '/../database/migrations/*.{ts,js}'],
    dropSchema: false, // Keep data between restarts
    synchronize: isTest, // Use synchronize in test for isolated worker schemas
    migrationsRun: false, // Don't auto-run migrations in test (synchronize handles schema)
    logging: !isProduction && !isTest,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  };
};
