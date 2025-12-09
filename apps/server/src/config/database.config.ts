import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isProduction = configService.get('nodeEnv') === 'production';
  const isTest = configService.get('nodeEnv') === 'test';
  const schema = configService.get<string>('database.schema', 'hollon');

  return {
    type: 'postgres',
    host: configService.get<string>('database.host'),
    port: configService.get<number>('database.port'),
    username: configService.get<string>('database.user'),
    password: configService.get<string>('database.password'),
    database: configService.get<string>('database.name'),
    schema: schema,
    entities: [__dirname + '/../**/*.entity.{ts,js}'],
    migrations: [__dirname + '/../database/migrations/*.{ts,js}'],

    // All environments use migration-based schema
    // Migrations should be run manually before tests via: pnpm db:migrate:test
    synchronize: false,
    migrationsRun: false,

    dropSchema: false, // Keep data between restarts
    logging: !isProduction && !isTest,
    ssl: isProduction ? { rejectUnauthorized: false } : false,

    // Set search_path to ensure unqualified table names use the correct schema
    extra: {
      options: `-c search_path=${schema},public`,
    },
  };
};
