import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EventEntity } from './entities/event.entity';
import { SnapshotEntity } from './entities/snapshot.entity';
import { EventStoreService } from './event-store.service';

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity, SnapshotEntity])],
  providers: [EventStoreService],
  exports: [EventStoreService],
})
export class EventStoreModule {}
