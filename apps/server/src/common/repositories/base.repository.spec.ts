import { DataSource, EntityManager } from 'typeorm';
import { BaseRepository } from './base.repository';
import { BaseEntity } from '../entities/base.entity';

// Test entity for testing purposes
class TestEntity extends BaseEntity {
  name!: string;
  value!: number;
}

describe('BaseRepository', () => {
  let repository: BaseRepository<TestEntity>;
  let dataSource: DataSource;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {} as EntityManager,
  };

  const mockDataSource: any = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
    createEntityManager: jest.fn((_qr?: any): any => ({
      connection: null,
    })),
    getMetadata: jest.fn(() => ({
      name: 'TestEntity',
    })),
  };

  // Set up circular reference after initialization
  mockDataSource.createEntityManager = jest.fn((_qr?: any): any => ({
    connection: mockDataSource,
  }));

  beforeEach(async () => {
    jest.clearAllMocks();

    dataSource = mockDataSource as unknown as DataSource;
    repository = new BaseRepository(TestEntity, dataSource, undefined);

    // Setup queryRunner manager with mock methods
    mockQueryRunner.manager = {
      insert: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
    } as unknown as EntityManager;
  });

  describe('batchInsert', () => {
    it('should insert entities in a single batch', async () => {
      const entities = [
        { name: 'Entity 1', value: 100 },
        { name: 'Entity 2', value: 200 },
      ];

      const insertResult = {
        identifiers: [{ id: '1' }, { id: '2' }],
        generatedMaps: [],
        raw: [],
      };

      (mockQueryRunner.manager.insert as jest.Mock).mockResolvedValue(
        insertResult,
      );

      // Mock findByIds
      jest
        .spyOn(repository, 'findByIds')
        .mockResolvedValue([
          { id: '1', name: 'Entity 1', value: 100 } as TestEntity,
          { id: '2', name: 'Entity 2', value: 200 } as TestEntity,
        ]);

      const result = await repository.batchInsert(entities);

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.insert).toHaveBeenCalledWith(
        TestEntity,
        entities,
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should insert entities in chunks for large datasets', async () => {
      const entities = Array.from({ length: 1200 }, (_, i) => ({
        name: `Entity ${i}`,
        value: i * 100,
      }));

      const insertResult = {
        identifiers: entities.map((_, i) => ({ id: `${i}` })),
        generatedMaps: [],
        raw: [],
      };

      (mockQueryRunner.manager.insert as jest.Mock).mockResolvedValue({
        identifiers: insertResult.identifiers.slice(0, 500),
        generatedMaps: [],
        raw: [],
      });

      jest
        .spyOn(repository, 'findByIds')
        .mockResolvedValue(
          entities.map((e, i) => ({ id: `${i}`, ...e }) as TestEntity),
        );

      const result = await repository.batchInsert(entities);

      // Should be called 3 times (1200 / 500 = 2.4, rounded up to 3)
      expect(mockQueryRunner.manager.insert).toHaveBeenCalledTimes(3);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toHaveLength(1200);
    });

    it('should return empty array for empty input', async () => {
      const result = await repository.batchInsert([]);

      expect(result).toEqual([]);
      expect(mockQueryRunner.connect).not.toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const entities = [{ name: 'Entity 1', value: 100 }];
      const error = new Error('Insert failed');

      (mockQueryRunner.manager.insert as jest.Mock).mockRejectedValue(error);

      await expect(repository.batchInsert(entities)).rejects.toThrow(
        'Insert failed',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should use custom chunk size', async () => {
      const entities = Array.from({ length: 100 }, (_, i) => ({
        name: `Entity ${i}`,
        value: i,
      }));

      const insertResult = {
        identifiers: [{ id: '1' }],
        generatedMaps: [],
        raw: [],
      };

      (mockQueryRunner.manager.insert as jest.Mock).mockResolvedValue(
        insertResult,
      );

      jest.spyOn(repository, 'findByIds').mockResolvedValue([]);

      await repository.batchInsert(entities, 50);

      // Should be called 2 times (100 / 50 = 2)
      expect(mockQueryRunner.manager.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('batchInsertRaw', () => {
    it('should insert entities without fetching results', async () => {
      const entities = [
        { name: 'Entity 1', value: 100 },
        { name: 'Entity 2', value: 200 },
      ];

      const insertResult = {
        identifiers: [{ id: '1' }, { id: '2' }],
        generatedMaps: [],
        raw: [],
      };

      (mockQueryRunner.manager.insert as jest.Mock).mockResolvedValue(
        insertResult,
      );

      const result = await repository.batchInsertRaw(entities);

      expect(mockQueryRunner.manager.insert).toHaveBeenCalled();
      expect(result.identifiers).toHaveLength(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should return empty result for empty input', async () => {
      const result = await repository.batchInsertRaw([]);

      expect(result).toEqual({
        identifiers: [],
        generatedMaps: [],
        raw: [],
      });
    });

    it('should handle chunked inserts', async () => {
      const entities = Array.from({ length: 1000 }, (_, i) => ({
        name: `Entity ${i}`,
        value: i,
      }));

      const insertResult = {
        identifiers: [{ id: '1' }],
        generatedMaps: [],
        raw: [],
      };

      (mockQueryRunner.manager.insert as jest.Mock).mockResolvedValue(
        insertResult,
      );

      await repository.batchInsertRaw(entities);

      // Should be called 2 times (1000 / 500 = 2)
      expect(mockQueryRunner.manager.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('batchUpdate', () => {
    it('should update entities matching criteria', async () => {
      const criteria = { value: 100 };
      const updates = { value: 150 };

      const entitiesToUpdate = [
        { id: '1', name: 'Entity 1', value: 100 } as TestEntity,
        { id: '2', name: 'Entity 2', value: 100 } as TestEntity,
      ];

      jest.spyOn(repository, 'find').mockResolvedValue(entitiesToUpdate);

      (mockQueryRunner.manager.update as jest.Mock).mockResolvedValue({
        affected: 2,
        raw: [],
        generatedMaps: [],
      });

      const result = await repository.batchUpdate(criteria, updates);

      expect(repository.find).toHaveBeenCalledWith({
        where: criteria,
      });
      expect(mockQueryRunner.manager.update).toHaveBeenCalled();
      expect(result.affected).toBe(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should return zero affected for no matching entities', async () => {
      const criteria = { value: 999 };
      const updates = { value: 1000 };

      jest.spyOn(repository, 'find').mockResolvedValue([]);

      const result = await repository.batchUpdate(criteria, updates);

      expect(result.affected).toBe(0);
      expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should update in chunks for large datasets', async () => {
      const criteria = { value: 100 };
      const updates = { value: 200 };

      const largeEntitySet = Array.from(
        { length: 1200 },
        (_, i) =>
          ({
            id: `${i}`,
            name: `Entity ${i}`,
            value: 100,
          }) as TestEntity,
      );

      jest.spyOn(repository, 'find').mockResolvedValue(largeEntitySet);

      (mockQueryRunner.manager.update as jest.Mock).mockResolvedValue({
        affected: 500,
        raw: [],
        generatedMaps: [],
      });

      await repository.batchUpdate(criteria, updates);

      // Should be called 3 times (1200 / 500 = 2.4, rounded up to 3)
      expect(mockQueryRunner.manager.update).toHaveBeenCalledTimes(3);
    });

    it('should rollback on error', async () => {
      const criteria = { value: 100 };
      const updates = { value: 200 };
      const error = new Error('Update failed');

      jest
        .spyOn(repository, 'find')
        .mockResolvedValue([
          { id: '1', name: 'Entity 1', value: 100 } as TestEntity,
        ]);

      (mockQueryRunner.manager.update as jest.Mock).mockRejectedValue(error);

      await expect(repository.batchUpdate(criteria, updates)).rejects.toThrow(
        'Update failed',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('batchSave', () => {
    it('should save entities using TypeORM save method', async () => {
      const entities = [
        { name: 'Entity 1', value: 100 },
        { name: 'Entity 2', value: 200 },
      ];

      (mockQueryRunner.manager.save as jest.Mock).mockResolvedValue([
        { id: '1', ...entities[0] },
        { id: '2', ...entities[1] },
      ]);

      const result = await repository.batchSave(entities);

      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        TestEntity,
        entities,
      );
      expect(result).toHaveLength(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should save in chunks', async () => {
      const entities = Array.from({ length: 1000 }, (_, i) => ({
        name: `Entity ${i}`,
        value: i,
      }));

      (mockQueryRunner.manager.save as jest.Mock).mockResolvedValue([]);

      await repository.batchSave(entities);

      // Should be called 2 times (1000 / 500 = 2)
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2);
    });

    it('should return empty array for empty input', async () => {
      const result = await repository.batchSave([]);

      expect(result).toEqual([]);
    });

    it('should rollback on error', async () => {
      const entities = [{ name: 'Entity 1', value: 100 }];
      const error = new Error('Save failed');

      (mockQueryRunner.manager.save as jest.Mock).mockRejectedValue(error);

      await expect(repository.batchSave(entities)).rejects.toThrow(
        'Save failed',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('withTransaction', () => {
    it('should execute operation within transaction', async () => {
      const operation = jest.fn().mockResolvedValue({ success: true });

      const result = await repository.withTransaction(operation);

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(operation).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should provide transactional repository to operation', async () => {
      let capturedRepo: BaseRepository<TestEntity> | null = null;

      await repository.withTransaction(async (repo) => {
        capturedRepo = repo;
        return { success: true };
      });

      expect(capturedRepo).toBeInstanceOf(BaseRepository);
    });

    it('should rollback on operation error', async () => {
      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(repository.withTransaction(operation)).rejects.toThrow(
        'Operation failed',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should allow complex multi-operation transactions', async () => {
      const insertResult = {
        identifiers: [{ id: '1' }, { id: '2' }],
        generatedMaps: [],
        raw: [],
      };

      (mockQueryRunner.manager.insert as jest.Mock).mockResolvedValue(
        insertResult,
      );

      (mockQueryRunner.manager.update as jest.Mock).mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });

      const result = await repository.withTransaction(async (_repo, qr) => {
        await qr.manager.insert(TestEntity, [{ name: 'New 1', value: 1 }]);
        await qr.manager.update(TestEntity, '1', { value: 100 });
        return { inserted: 1, updated: 1 };
      });

      expect(result).toEqual({ inserted: 1, updated: 1 });
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('transaction management', () => {
    it('should properly clean up resources even on error', async () => {
      const error = new Error('Database error');
      (mockQueryRunner.manager.insert as jest.Mock).mockRejectedValue(error);

      await expect(
        repository.batchInsert([{ name: 'Test', value: 1 }]),
      ).rejects.toThrow();

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should handle concurrent batch operations', async () => {
      const insertResult = {
        identifiers: [{ id: '1' }],
        generatedMaps: [],
        raw: [],
      };

      (mockQueryRunner.manager.insert as jest.Mock).mockResolvedValue(
        insertResult,
      );

      jest
        .spyOn(repository, 'findByIds')
        .mockResolvedValue([{ id: '1', name: 'Test', value: 1 } as TestEntity]);

      const promises = [
        repository.batchInsert([{ name: 'Test 1', value: 1 }]),
        repository.batchInsert([{ name: 'Test 2', value: 2 }]),
        repository.batchInsert([{ name: 'Test 3', value: 3 }]),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toHaveLength(1);
      });
    });
  });

  describe('performance and edge cases', () => {
    it('should handle single entity batch insert', async () => {
      const entities = [{ name: 'Single', value: 1 }];

      const insertResult = {
        identifiers: [{ id: '1' }],
        generatedMaps: [],
        raw: [],
      };

      (mockQueryRunner.manager.insert as jest.Mock).mockResolvedValue(
        insertResult,
      );

      jest
        .spyOn(repository, 'findByIds')
        .mockResolvedValue([
          { id: '1', name: 'Single', value: 1 } as TestEntity,
        ]);

      const result = await repository.batchInsert(entities);

      expect(result).toHaveLength(1);
    });

    it('should handle exact chunk size boundary', async () => {
      const entities = Array.from({ length: 500 }, (_, i) => ({
        name: `Entity ${i}`,
        value: i,
      }));

      const insertResult = {
        identifiers: entities.map((_, i) => ({ id: `${i}` })),
        generatedMaps: [],
        raw: [],
      };

      (mockQueryRunner.manager.insert as jest.Mock).mockResolvedValue(
        insertResult,
      );

      jest.spyOn(repository, 'findByIds').mockResolvedValue([]);

      await repository.batchInsert(entities);

      // Should be called exactly once for 500 entities
      expect(mockQueryRunner.manager.insert).toHaveBeenCalledTimes(1);
    });

    it('should handle chunk size + 1 boundary', async () => {
      const entities = Array.from({ length: 501 }, (_, i) => ({
        name: `Entity ${i}`,
        value: i,
      }));

      const insertResult = {
        identifiers: [{ id: '1' }],
        generatedMaps: [],
        raw: [],
      };

      (mockQueryRunner.manager.insert as jest.Mock).mockResolvedValue(
        insertResult,
      );

      jest.spyOn(repository, 'findByIds').mockResolvedValue([]);

      await repository.batchInsert(entities);

      // Should be called 2 times (501 / 500 = 1.002)
      expect(mockQueryRunner.manager.insert).toHaveBeenCalledTimes(2);
    });
  });
});
