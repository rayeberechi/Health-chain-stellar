import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Append-only event store for order domain events.
 * Rows in this table are NEVER updated or deleted — they form an
 * immutable audit log from which the current order state can always
 * be replayed.
 *
 * Columns
 * ───────
 * order_id    – foreign key to the orders table (not enforced as FK so the
 *               table remains independent and deletions are blocked upstream)
 * event_type  – one of the OrderEventType enum values
 * payload     – JSON snapshot of the data relevant to this event
 * actor_id    – ID of the user / service that triggered the transition
 * timestamp   – auto-set server-side at insert time (never editable)
 */
@Entity('order_events')
@Index('idx_order_events_order_id', ['orderId'])
export class OrderEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @Column({ name: 'event_type' })
  eventType: string;

  @Column({ type: 'jsonb', default: '{}' })
  payload: Record<string, any>;

  @Column({ name: 'actor_id', nullable: true, type: 'varchar' })
  actorId: string | null;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;
}
