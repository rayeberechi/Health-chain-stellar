import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Registry } from 'prom-client';

import {
  AnchorRecordEntity,
  AnchorStatus,
} from './entities/anchor-record.entity';
import { ReconciliationRunEntity } from './entities/reconciliation-run.entity';
import { LedgerReconciliationService } from './ledger-reconciliation.service';

// ── Horizon mock ──────────────────────────────────────────────────────────────

const mockTransactionCall = jest.fn();

jest.mock('@stellar/stellar-sdk', () => ({
  Horizon: {
    Server: jest.fn().mockImplementation(() => ({
      transactions: () => ({
        transaction: () => ({ call: mockTransactionCall }),
      }),
    })),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const tenMinutesAgo = new Date(Date.now() - 11 * 60_000);

const makePending = (id: string, txHash: string): AnchorRecordEntity =>
  ({
    id,
    stellarTxHash: txHash,
    cid: `cid-${id}`,
    status: AnchorStatus.PENDING,
    aggregateId: null,
    createdAt: tenMinutesAgo,
    updatedAt: null,
  }) as AnchorRecordEntity;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LedgerReconciliationService', () => {
  let service: LedgerReconciliationService;

  const savedRuns: Partial<ReconciliationRunEntity>[] = [];

  const mockAnchorRepo = {
    find: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };

  const mockRunRepo = {
    create: jest
      .fn()
      .mockImplementation(
        (data: Partial<ReconciliationRunEntity>) =>
          ({ id: 'run-1', ...data }) as ReconciliationRunEntity,
      ),
    save: jest
      .fn()
      .mockImplementation((data: Partial<ReconciliationRunEntity>) => {
        const run: Partial<ReconciliationRunEntity> = {
          id: 'run-1',
          startedAt: new Date(),
          ...data,
        };
        savedRuns.push(run);
        return Promise.resolve(run);
      }),
    findOne: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn().mockImplementation((key: string, def?: string) => {
      if (key === 'HORIZON_URL') return 'https://horizon-testnet.stellar.org';
      if (key === 'SLACK_OPS_WEBHOOK_URL') return undefined;
      return def;
    }),
  };

  beforeEach(async () => {
    savedRuns.length = 0;
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerReconciliationService,
        {
          provide: getRepositoryToken(AnchorRecordEntity),
          useValue: mockAnchorRepo,
        },
        {
          provide: getRepositoryToken(ReconciliationRunEntity),
          useValue: mockRunRepo,
        },
        { provide: ConfigService, useValue: mockConfig },
        { provide: Registry, useValue: new Registry() },
      ],
    }).compile();

    service = module.get<LedgerReconciliationService>(
      LedgerReconciliationService,
    );
  });

  describe('run() — confirmed scenario', () => {
    it('marks record as confirmed when Horizon returns successful tx', async () => {
      mockAnchorRepo.find.mockResolvedValue([
        makePending('r-1', 'tx-confirmed'),
      ]);
      mockTransactionCall.mockResolvedValue({ successful: true });

      const result = await service.run();

      expect(mockAnchorRepo.update).toHaveBeenCalledWith(
        'r-1',
        expect.objectContaining({ status: AnchorStatus.CONFIRMED }),
      );
      expect(result.confirmed).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.missing).toBe(0);
    });
  });

  describe('run() — failed scenario', () => {
    it('marks record as failed when Horizon returns unsuccessful tx', async () => {
      mockAnchorRepo.find.mockResolvedValue([makePending('r-2', 'tx-failed')]);
      mockTransactionCall.mockResolvedValue({ successful: false });

      const result = await service.run();

      expect(mockAnchorRepo.update).toHaveBeenCalledWith(
        'r-2',
        expect.objectContaining({ status: AnchorStatus.FAILED }),
      );
      expect(result.failed).toBe(1);
      expect(result.confirmed).toBe(0);
    });
  });

  describe('run() — missing scenario', () => {
    it('marks record as missing when Horizon returns 404', async () => {
      mockAnchorRepo.find.mockResolvedValue([makePending('r-3', 'tx-missing')]);
      mockTransactionCall.mockRejectedValue({ response: { status: 404 } });

      const result = await service.run();

      expect(mockAnchorRepo.update).toHaveBeenCalledWith(
        'r-3',
        expect.objectContaining({ status: AnchorStatus.MISSING }),
      );
      expect(result.missing).toBe(1);
    });
  });

  describe('run() — mixed batch', () => {
    it('correctly tallies confirmed, failed, and missing across multiple records', async () => {
      mockAnchorRepo.find.mockResolvedValue([
        makePending('r-1', 'tx-1'),
        makePending('r-2', 'tx-2'),
        makePending('r-3', 'tx-3'),
      ]);

      mockTransactionCall
        .mockResolvedValueOnce({ successful: true })
        .mockResolvedValueOnce({ successful: false })
        .mockRejectedValueOnce({ response: { status: 404 } });

      const result = await service.run();

      expect(result.recordsChecked).toBe(3);
      expect(result.confirmed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.missing).toBe(1);
      expect(result.errors).toBe(0);
    });
  });

  describe('run() — Horizon network error', () => {
    it('increments errors counter when Horizon throws a non-404 error', async () => {
      mockAnchorRepo.find.mockResolvedValue([makePending('r-4', 'tx-err')]);
      mockTransactionCall.mockRejectedValue(new Error('network timeout'));

      const result = await service.run();

      expect(result.errors).toBe(1);
      expect(result.confirmed).toBe(0);
    });
  });

  describe('run() — empty pending set', () => {
    it('completes with zero counts when no pending records exist', async () => {
      mockAnchorRepo.find.mockResolvedValue([]);

      const result = await service.run();

      expect(result.recordsChecked).toBe(0);
      expect(result.confirmed).toBe(0);
      expect(mockAnchorRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('getLatestRun()', () => {
    it('returns the most recent run from the repository', async () => {
      const run = {
        id: 'run-latest',
        startedAt: new Date(),
      } as ReconciliationRunEntity;
      mockRunRepo.findOne.mockResolvedValue(run);

      const result = await service.getLatestRun();
      expect(result?.id).toBe('run-latest');
    });

    it('returns null when no runs exist', async () => {
      mockRunRepo.findOne.mockResolvedValue(null);
      expect(await service.getLatestRun()).toBeNull();
    });
  });
});
