import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface AggregateSnapshot {
  aggregateId: string;
  aggregateType: string;
  version: number;
  state: Record<string, unknown>;
  snapshotAt: Date;
}

@Entity('aggregate_snapshots')
@Index('idx_snapshots_aggregate', ['aggregateId'], { unique: true })
export class SnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'aggregate_id', unique: true })
  aggregateId: string;

  @Column({ name: 'aggregate_type' })
  aggregateType: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'jsonb' })
  state: Record<string, unknown>;

  @UpdateDateColumn({ name: 'snapshot_at', type: 'timestamp with time zone' })
  snapshotAt: Date;
}
