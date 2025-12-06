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
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    synchronize: isTest, // 테스트 환경에서는 자동 동기화, 프로덕션에서는 마이그레이션 사용
    migrationsRun: false, // 서버 시작 시 자동 마이그레이션 실행 안 함
    logging: !isProduction && !isTest,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  };
};
