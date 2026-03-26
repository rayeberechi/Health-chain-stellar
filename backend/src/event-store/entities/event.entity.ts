import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('event_store')
@Index('idx_event_store_aggregate', ['aggregateId', 'version'], {
  unique: true,
})
@Index('idx_event_store_aggregate_type', ['aggregateId', 'aggregateType'])
export class EventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'aggregate_id' })
  aggregateId: string;

  @Column({ name: 'aggregate_type' })
  aggregateType: string;

  @Column({ name: 'event_type' })
  eventType: string;

  @Column({ type: 'jsonb', default: '{}' })
  payload: Record<string, unknown>;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  @Column({ type: 'int' })
  version: number;

  @Column({ name: 'occurred_at', type: 'timestamp with time zone' })
  occurredAt: Date;

  @CreateDateColumn({ name: 'recorded_at', type: 'timestamp with time zone' })
  recordedAt: Date;
}
