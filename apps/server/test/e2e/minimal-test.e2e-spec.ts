import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';

describe('Minimal Test', () => {
  let app: INestApplication;

  beforeAll(async () => {
    console.log('🧪 Starting minimal test...');
    console.log('📦 Creating testing module...');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    console.log('✅ Module compiled successfully!');

    app = moduleFixture.createNestApplication();
    await app.init();

    console.log('✅ App initialized successfully!');
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  it('should initialize without hanging', () => {
    expect(app).toBeDefined();
    console.log('✅ Test passed!');
  });
});
