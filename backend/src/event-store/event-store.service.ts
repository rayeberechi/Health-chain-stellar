import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { DataSource, Repository } from 'typeorm';

import { DomainEvent } from './domain-events/domain-event.interface';
import { EventEntity } from './entities/event.entity';
import { AggregateSnapshot, SnapshotEntity } from './entities/snapshot.entity';
import { ConcurrencyException } from './exceptions/concurrency.exception';

const SNAPSHOT_THRESHOLD = 50;

@Injectable()
export class EventStoreService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepo: Repository<EventEntity>,
    @InjectRepository(SnapshotEntity)
    private readonly snapshotRepo: Repository<SnapshotEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Appends events to the store with optimistic concurrency control.
   * Throws ConcurrencyException if the current version doesn't match expectedVersion.
   */
  async append(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const currentVersion = await this.getCurrentVersion(aggregateId, manager);

      if (currentVersion !== expectedVersion) {
        throw new ConcurrencyException(
          aggregateId,
          expectedVersion,
          currentVersion,
        );
      }

      const entities = events.map((event, i) =>
        manager.create(EventEntity, {
          aggregateId,
          aggregateType: event.aggregateType,
          eventType: event.eventType,
          payload: event.payload,
          metadata: event.metadata ?? {},
          version: expectedVersion + i + 1,
          occurredAt: event.occurredAt ?? new Date(),
        }),
      );

      await manager.save(EventEntity, entities);
    });
  }

  /**
   * Returns all events for an aggregate, optionally starting from a version.
   */
  async getEvents(
    aggregateId: string,
    fromVersion = 0,
  ): Promise<DomainEvent[]> {
    const rows = await this.eventRepo
      .createQueryBuilder('e')
      .where('e.aggregateId = :aggregateId', { aggregateId })
      .andWhere('e.version > :fromVersion', { fromVersion })
      .orderBy('e.version', 'ASC')
      .getMany();

    return rows.map((row) => ({
      eventType: row.eventType,
      aggregateId: row.aggregateId,
      aggregateType: row.aggregateType,
      payload: row.payload,
      metadata: row.metadata,
      occurredAt: row.occurredAt,
    }));
  }

  /**
   * Returns the latest snapshot for an aggregate, or null if none exists.
   */
  async getSnapshot(aggregateId: string): Promise<AggregateSnapshot | null> {
    const snap = await this.snapshotRepo.findOne({ where: { aggregateId } });
    if (!snap) return null;
    return {
      aggregateId: snap.aggregateId,
      aggregateType: snap.aggregateType,
      version: snap.version,
      state: snap.state,
      snapshotAt: snap.snapshotAt,
    };
  }

  /**
   * Saves or updates a snapshot for an aggregate.
   * Called automatically after every SNAPSHOT_THRESHOLD events.
   */
  async saveSnapshot(
    aggregateId: string,
    aggregateType: string,
    version: number,
    state: Record<string, unknown>,
  ): Promise<void> {
    await this.snapshotRepo.upsert(
      { aggregateId, aggregateType, version, state },
      ['aggregateId'],
    );
  }

  /**
   * Returns the highest version number stored for an aggregate (0 if none).
   */
  private async getCurrentVersion(
    aggregateId: string,
    manager = this.dataSource.manager,
  ): Promise<number> {
    const result = await manager
      .createQueryBuilder(EventEntity, 'e')
      .select('MAX(e.version)', 'max')
      .where('e.aggregateId = :aggregateId', { aggregateId })
      .getRawOne<{ max: string | null }>();

    return result?.max != null ? parseInt(result.max, 10) : 0;
  }

  /**
   * Checks whether a snapshot should be taken after appending events.
   * Callers (e.g. the aggregate) invoke this after a successful append.
   */
  shouldSnapshot(currentVersion: number): boolean {
    return currentVersion % SNAPSHOT_THRESHOLD === 0;
  }
}
