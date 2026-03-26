import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DataSource, SelectQueryBuilder } from 'typeorm';

import { DomainEvent } from './domain-events/domain-event.interface';
import { MedicalRecordEventType } from './domain-events/medical-record.events';
import { EventEntity } from './entities/event.entity';
import { SnapshotEntity } from './entities/snapshot.entity';
import { EventStoreService } from './event-store.service';
import { ConcurrencyException } from './exceptions/concurrency.exception';

const makeEvent = (eventType: string, aggregateId = 'agg-1'): DomainEvent => ({
  eventType,
  aggregateId,
  aggregateType: 'MedicalRecord',
  payload: {
    patientId: 'p-1',
    uploadedBy: 'u-1',
    fileHash: 'abc',
    recordType: 'lab',
  },
});

describe('EventStoreService', () => {
  let service: EventStoreService;

  const savedEntities: EventEntity[] = [];

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ max: null }),
    getMany: jest.fn().mockResolvedValue([]),
  } as unknown as SelectQueryBuilder<EventEntity>;

  const mockEventRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    findOne: jest.fn(),
  };

  const mockSnapshotRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue(undefined),
  };

  const mockManager = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    create: jest
      .fn()
      .mockImplementation((_entity: unknown, data: EventEntity) => data),
    save: jest
      .fn()
      .mockImplementation((_entity: unknown, entities: EventEntity[]) => {
        savedEntities.push(...entities);
        return Promise.resolve(entities);
      }),
  };

  const mockDataSource = {
    transaction: jest
      .fn()
      .mockImplementation(
        (cb: (manager: typeof mockManager) => Promise<void>) => cb(mockManager),
      ),
    manager: mockManager,
  };

  beforeEach(async () => {
    savedEntities.length = 0;
    jest.clearAllMocks();
    // Reset to default: no existing events
    mockQueryBuilder.getRawOne = jest.fn().mockResolvedValue({ max: null });
    mockQueryBuilder.getMany = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventStoreService,
        { provide: getRepositoryToken(EventEntity), useValue: mockEventRepo },
        {
          provide: getRepositoryToken(SnapshotEntity),
          useValue: mockSnapshotRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<EventStoreService>(EventStoreService);
  });

  describe('append', () => {
    it('appends events when expectedVersion matches current version (0)', async () => {
      const events = [makeEvent(MedicalRecordEventType.RECORD_UPLOADED)];
      await service.append('agg-1', events, 0);

      expect(mockManager.save).toHaveBeenCalledTimes(1);
      const saved = savedEntities[0];
      expect(saved.version).toBe(1);
      expect(saved.eventType).toBe(MedicalRecordEventType.RECORD_UPLOADED);
    });

    it('assigns sequential versions for multiple events', async () => {
      const events = [
        makeEvent(MedicalRecordEventType.RECORD_UPLOADED),
        makeEvent(MedicalRecordEventType.ACCESS_GRANTED),
      ];
      await service.append('agg-1', events, 0);

      expect(savedEntities[0].version).toBe(1);
      expect(savedEntities[1].version).toBe(2);
    });

    it('throws ConcurrencyException when expectedVersion does not match', async () => {
      // Simulate existing version = 3
      mockQueryBuilder.getRawOne = jest.fn().mockResolvedValue({ max: '3' });

      await expect(
        service.append(
          'agg-1',
          [makeEvent(MedicalRecordEventType.RECORD_UPLOADED)],
          0,
        ),
      ).rejects.toThrow(ConcurrencyException);
    });

    it('ConcurrencyException message contains aggregateId and versions', async () => {
      mockQueryBuilder.getRawOne = jest.fn().mockResolvedValue({ max: '5' });

      await expect(
        service.append(
          'agg-42',
          [makeEvent(MedicalRecordEventType.RECORD_UPLOADED, 'agg-42')],
          2,
        ),
      ).rejects.toThrow(/agg-42/);
    });
  });

  describe('getEvents', () => {
    it('returns mapped DomainEvent array', async () => {
      const row: Partial<EventEntity> = {
        eventType: MedicalRecordEventType.RECORD_UPLOADED,
        aggregateId: 'agg-1',
        aggregateType: 'MedicalRecord',
        payload: { patientId: 'p-1' } as Record<string, unknown>,
        metadata: {},
        occurredAt: new Date(),
      };
      mockQueryBuilder.getMany = jest.fn().mockResolvedValue([row]);

      const events = await service.getEvents('agg-1');
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe(MedicalRecordEventType.RECORD_UPLOADED);
    });

    it('returns empty array when no events exist', async () => {
      const events = await service.getEvents('agg-unknown');
      expect(events).toEqual([]);
    });
  });

  describe('getSnapshot', () => {
    it('returns null when no snapshot exists', async () => {
      const snap = await service.getSnapshot('agg-1');
      expect(snap).toBeNull();
    });

    it('returns mapped snapshot when one exists', async () => {
      const snapRow: Partial<SnapshotEntity> = {
        aggregateId: 'agg-1',
        aggregateType: 'MedicalRecord',
        version: 50,
        state: { isDeleted: false } as Record<string, unknown>,
        snapshotAt: new Date(),
      };
      mockSnapshotRepo.findOne = jest.fn().mockResolvedValue(snapRow);

      const snap = await service.getSnapshot('agg-1');
      expect(snap).not.toBeNull();
      expect(snap!.version).toBe(50);
      expect(snap!.aggregateId).toBe('agg-1');
    });
  });

  describe('saveSnapshot', () => {
    it('calls upsert with correct data', async () => {
      await service.saveSnapshot('agg-1', 'MedicalRecord', 50, {
        isDeleted: false,
      });
      expect(mockSnapshotRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ aggregateId: 'agg-1', version: 50 }),
        ['aggregateId'],
      );
    });
  });

  describe('shouldSnapshot', () => {
    it('returns true at multiples of 50', () => {
      expect(service.shouldSnapshot(50)).toBe(true);
      expect(service.shouldSnapshot(100)).toBe(true);
    });

    it('returns false for non-multiples of 50', () => {
      expect(service.shouldSnapshot(1)).toBe(false);
      expect(service.shouldSnapshot(49)).toBe(false);
      expect(service.shouldSnapshot(51)).toBe(false);
    });
  });
});
