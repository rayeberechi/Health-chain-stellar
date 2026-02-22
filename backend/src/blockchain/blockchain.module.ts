import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SorobanService } from './services/soroban.service';
import { IdempotencyService } from './services/idempotency.service';
import { SorobanTxProcessor } from './processors/soroban-tx.processor';
import { SorobanDlqProcessor } from './processors/soroban-dlq.processor';
import { BlockchainController } from './controllers/blockchain.controller';
import { AdminGuard } from './guards/admin.guard';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'soroban-tx-queue',
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
      {
        name: 'soroban-dlq',
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      },
    ),
  ],
  providers: [
    SorobanService,
    IdempotencyService,
    SorobanTxProcessor,
    SorobanDlqProcessor,
    AdminGuard,
  ],
  controllers: [BlockchainController],
  exports: [SorobanService],
})
export class BlockchainModule {}
