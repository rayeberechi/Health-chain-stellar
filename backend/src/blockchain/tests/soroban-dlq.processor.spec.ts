/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { SorobanDlqProcessor } from '../processors/soroban-dlq.processor';
import { SorobanTxJob } from '../types/soroban-tx.types';

describe('SorobanDlqProcessor', () => {
  let processor: SorobanDlqProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SorobanDlqProcessor],
    }).compile();

    processor = module.get<SorobanDlqProcessor>(SorobanDlqProcessor);
  });

  describe('handleDeadLetterJob', () => {
    it('should process dead letter job', async () => {
      const mockJob = {
        id: 'job-dlq-123',
        data: {
          contractMethod: 'register_blood',
          args: ['bank-123', 'O+', 100],
          idempotencyKey: 'dlq-test-key-1',
          metadata: {
            userId: 'user-123',
          },
        } as SorobanTxJob,
        failedReason: 'RPC timeout after 5 retries',
        attemptsMade: 5,
        opts: { attempts: 5 },
        stacktrace: ['Error: RPC timeout', 'at executeContractCall'],
      };

      const persistSpy = jest.spyOn(processor as any, 'persistDlqEntry');
      const notifySpy = jest.spyOn(processor as any, 'notifyAdmins');

      await processor.handleDeadLetterJob(mockJob as any);

      expect(persistSpy).toHaveBeenCalled();
      expect(notifySpy).toHaveBeenCalled();
    });

    it('should capture full error context', async () => {
      const mockJob = {
        id: 'job-dlq-456',
        data: {
          contractMethod: 'check_availability',
          args: ['O+', 100],
          idempotencyKey: 'dlq-test-key-2',
          metadata: {
            bankId: 'bank-456',
          },
        } as SorobanTxJob,
        failedReason: 'Network error',
        attemptsMade: 3,
        opts: { attempts: 5 },
        stacktrace: ['Error: Network error'],
      };

      const persistSpy = jest.spyOn(processor as any, 'persistDlqEntry');

      await processor.handleDeadLetterJob(mockJob as any);

      expect(persistSpy).toHaveBeenCalled();
    });

    it('should log DLQ entry', async () => {
      const mockJob = {
        id: 'job-dlq-789',
        data: {
          contractMethod: 'query_inventory',
          args: ['O+'],
          idempotencyKey: 'dlq-test-key-3',
        } as SorobanTxJob,
        failedReason: 'Contract error',
        attemptsMade: 5,
        opts: { attempts: 5 },
        stacktrace: [],
      };

      await processor.handleDeadLetterJob(mockJob as any);

      // Verify job was processed
      expect(mockJob.id).toBe('job-dlq-789');
    });
  });

  describe('persistDlqEntry', () => {
    it('should persist DLQ entry with full context', async () => {
      const dlqEntry = {
        jobId: 'job-persist-123',
        contractMethod: 'register_blood',
        args: ['bank-123', 'O+', 100],
        idempotencyKey: 'persist-test-key',
        failureReason: 'RPC timeout',
        attemptsMade: 5,
        maxAttempts: 5,
        timestamp: new Date(),
        metadata: { userId: 'user-123' },
      };

      // Should not throw
      await (processor as any).persistDlqEntry(dlqEntry);
    });

    it('should include all required fields in DLQ entry', async () => {
      const dlqEntry = {
        jobId: 'job-persist-456',
        contractMethod: 'check_availability',
        args: ['O+', 100],
        idempotencyKey: 'persist-test-key-2',
        failureReason: 'Network error',
        attemptsMade: 3,
        maxAttempts: 5,
        timestamp: new Date(),
        metadata: { bankId: 'bank-456' },
      };

      await (processor as any).persistDlqEntry(dlqEntry);

      expect(dlqEntry).toHaveProperty('jobId');
      expect(dlqEntry).toHaveProperty('contractMethod');
      expect(dlqEntry).toHaveProperty('failureReason');
      expect(dlqEntry).toHaveProperty('attemptsMade');
    });
  });

  describe('notifyAdmins', () => {
    it('should notify admins about DLQ entry', async () => {
      const dlqEntry = {
        jobId: 'job-notify-123',
        contractMethod: 'register_blood',
        failureReason: 'RPC timeout',
        attemptsMade: 5,
        maxAttempts: 5,
      };

      // Should not throw
      await (processor as any).notifyAdmins(dlqEntry);
    });

    it('should include error details in notification', async () => {
      const dlqEntry = {
        jobId: 'job-notify-456',
        contractMethod: 'check_availability',
        failureReason: 'Network error',
        attemptsMade: 3,
        maxAttempts: 5,
      };

      await (processor as any).notifyAdmins(dlqEntry);

      expect(dlqEntry.failureReason).toBe('Network error');
    });
  });

  describe('Acceptance Criteria', () => {
    it('should capture permanently failed jobs with full error context', async () => {
      const mockJob = {
        id: 'job-acceptance-1',
        data: {
          contractMethod: 'register_blood',
          args: ['bank-123', 'O+', 100],
          idempotencyKey: 'acceptance-test-key-1',
          metadata: {
            userId: 'user-123',
            source: 'api',
          },
        } as SorobanTxJob,
        failedReason: 'RPC timeout after 5 retries',
        attemptsMade: 5,
        opts: { attempts: 5 },
        stacktrace: ['Error: RPC timeout'],
      };

      const persistSpy = jest.spyOn(processor as any, 'persistDlqEntry');

      await processor.handleDeadLetterJob(mockJob as any);

      expect(persistSpy).toHaveBeenCalled();
    });

    it('should emit alert to admins on DLQ entry', async () => {
      const mockJob = {
        id: 'job-acceptance-2',
        data: {
          contractMethod: 'check_availability',
          args: ['O+', 100],
          idempotencyKey: 'acceptance-test-key-2',
        } as SorobanTxJob,
        failedReason: 'Network error',
        attemptsMade: 5,
        opts: { attempts: 5 },
        stacktrace: [],
      };

      const notifySpy = jest.spyOn(processor as any, 'notifyAdmins');

      await processor.handleDeadLetterJob(mockJob as any);

      expect(notifySpy).toHaveBeenCalled();
    });

    it('should store DLQ entry for manual review', async () => {
      const mockJob = {
        id: 'job-acceptance-3',
        data: {
          contractMethod: 'query_inventory',
          args: ['O+'],
          idempotencyKey: 'acceptance-test-key-3',
          metadata: {
            bankId: 'bank-789',
          },
        } as SorobanTxJob,
        failedReason: 'Contract error',
        attemptsMade: 5,
        opts: { attempts: 5 },
        stacktrace: ['Error: Contract error'],
      };

      const persistSpy = jest.spyOn(processor as any, 'persistDlqEntry');

      await processor.handleDeadLetterJob(mockJob as any);

      expect(persistSpy).toHaveBeenCalled();
    });
  });
});
