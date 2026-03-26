import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { LedgerReconciliationService } from './ledger-reconciliation.service';

@Injectable()
export class ReconciliationJob {
  private readonly logger = new Logger(ReconciliationJob.name);
  private isRunning = false;

  constructor(
    private readonly reconciliationService: LedgerReconciliationService,
  ) {}

  @Cron('0 */15 * * * *')
  async runScheduled(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(
        'Reconciliation already in progress — skipping scheduled run',
      );
      return;
    }
    this.isRunning = true;
    try {
      await this.reconciliationService.run();
    } finally {
      this.isRunning = false;
    }
  }
}
