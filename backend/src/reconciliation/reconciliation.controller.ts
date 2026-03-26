import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
} from '@nestjs/common';

import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/enums/permission.enum';

import { ReconciliationRunEntity } from './entities/reconciliation-run.entity';
import { LedgerReconciliationService } from './ledger-reconciliation.service';
import { ReconciliationJob } from './reconciliation.job';

@Controller('admin/reconciliation')
@RequirePermissions(Permission.ADMIN_ACCESS)
export class ReconciliationController {
  constructor(
    private readonly reconciliationService: LedgerReconciliationService,
    private readonly reconciliationJob: ReconciliationJob,
  ) {}

  @Get('latest')
  @HttpCode(HttpStatus.OK)
  async getLatest(): Promise<ReconciliationRunEntity> {
    const run = await this.reconciliationService.getLatestRun();
    if (!run) throw new NotFoundException('No reconciliation runs found');
    return run;
  }

  @Post('trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  trigger(): { message: string } {
    void this.reconciliationJob.runScheduled();
    return { message: 'Reconciliation run triggered' };
  }
}
