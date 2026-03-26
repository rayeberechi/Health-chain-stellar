import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { Horizon } from '@stellar/stellar-sdk';
import { Counter, Registry } from 'prom-client';
import { LessThan, Repository } from 'typeorm';

import {
  AnchorRecordEntity,
  AnchorStatus,
} from './entities/anchor-record.entity';
import { ReconciliationRunEntity } from './entities/reconciliation-run.entity';

const MISSING_ALERT_THRESHOLD = 5;
const PENDING_OLDER_THAN_MINUTES = 10;

@Injectable()
export class LedgerReconciliationService {
  private readonly logger = new Logger(LedgerReconciliationService.name);
  private readonly horizonServer: Horizon.Server;
  private readonly discrepanciesCounter: Counter;

  constructor(
    @InjectRepository(AnchorRecordEntity)
    private readonly anchorRepo: Repository<AnchorRecordEntity>,
    @InjectRepository(ReconciliationRunEntity)
    private readonly runRepo: Repository<ReconciliationRunEntity>,
    private readonly config: ConfigService,
    registry: Registry,
  ) {
    const horizonUrl = this.config.get<string>(
      'HORIZON_URL',
      'https://horizon-testnet.stellar.org',
    );
    this.horizonServer = new Horizon.Server(horizonUrl);

    this.discrepanciesCounter = new Counter({
      name: 'medchain_reconciliation_discrepancies_total',
      help: 'Total number of reconciliation discrepancies found',
      labelNames: ['type'],
      registers: [registry],
    });
  }

  async run(): Promise<ReconciliationRunEntity> {
    const runRecord = await this.runRepo.save(
      this.runRepo.create({ completedAt: null }),
    );

    const cutoff = new Date(Date.now() - PENDING_OLDER_THAN_MINUTES * 60_000);
    const pending = await this.anchorRepo.find({
      where: { status: AnchorStatus.PENDING, createdAt: LessThan(cutoff) },
    });

    let confirmed = 0;
    let failed = 0;
    let missing = 0;
    let errors = 0;

    for (const record of pending) {
      try {
        const result = await this.checkTransaction(record.stellarTxHash);

        if (result === 'confirmed') {
          await this.anchorRepo.update(record.id, {
            status: AnchorStatus.CONFIRMED,
            updatedAt: new Date(),
          });
          confirmed++;
        } else if (result === 'failed') {
          await this.anchorRepo.update(record.id, {
            status: AnchorStatus.FAILED,
            updatedAt: new Date(),
          });
          this.discrepanciesCounter.inc({ type: 'failed' });
          failed++;
        } else {
          await this.anchorRepo.update(record.id, {
            status: AnchorStatus.MISSING,
            updatedAt: new Date(),
          });
          this.discrepanciesCounter.inc({ type: 'missing' });
          missing++;
        }
      } catch (err) {
        this.logger.error(
          `Error reconciling record ${record.id}: ${(err as Error).message}`,
        );
        errors++;
      }
    }

    if (missing > MISSING_ALERT_THRESHOLD) {
      await this.alertOps(missing, runRecord.id);
    }

    const completed = await this.runRepo.save({
      ...runRecord,
      completedAt: new Date(),
      recordsChecked: pending.length,
      confirmed,
      failed,
      missing,
      errors,
    });

    this.logger.log(
      `Reconciliation run ${runRecord.id}: checked=${pending.length} confirmed=${confirmed} failed=${failed} missing=${missing} errors=${errors}`,
    );

    return completed;
  }

  async getLatestRun(): Promise<ReconciliationRunEntity | null> {
    return this.runRepo.findOne({
      where: {},
      order: { startedAt: 'DESC' },
    });
  }

  private async checkTransaction(
    txHash: string,
  ): Promise<'confirmed' | 'failed' | 'missing'> {
    try {
      const tx = await this.horizonServer
        .transactions()
        .transaction(txHash)
        .call();

      return tx.successful ? 'confirmed' : 'failed';
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 404) return 'missing';
      throw err;
    }
  }

  private async alertOps(missingCount: number, runId: string): Promise<void> {
    const webhookUrl = this.config.get<string>('SLACK_OPS_WEBHOOK_URL');
    if (!webhookUrl) {
      this.logger.warn('SLACK_OPS_WEBHOOK_URL not configured — skipping alert');
      return;
    }

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 *Reconciliation Alert* — run \`${runId}\`: *${missingCount}* missing transactions exceed threshold of ${MISSING_ALERT_THRESHOLD}. Immediate investigation required.`,
        }),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send Slack alert: ${(err as Error).message}`,
      );
    }
  }
}
