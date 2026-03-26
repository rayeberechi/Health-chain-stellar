import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AnchorRecordEntity } from './entities/anchor-record.entity';
import { ReconciliationRunEntity } from './entities/reconciliation-run.entity';
import { LedgerReconciliationService } from './ledger-reconciliation.service';
import { PrometheusModule } from './prometheus.module';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationJob } from './reconciliation.job';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnchorRecordEntity, ReconciliationRunEntity]),
    PrometheusModule,
  ],
  providers: [LedgerReconciliationService, ReconciliationJob],
  controllers: [ReconciliationController],
  exports: [LedgerReconciliationService],
})
export class ReconciliationModule {}
