import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AnchorStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  MISSING = 'missing',
}

/**
 * Represents a CID anchor record that must be reconciled against Stellar.
 * Populated by the application when it submits a Stellar transaction.
 */
@Entity('anchor_records')
export class AnchorRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'stellar_tx_hash', type: 'varchar', length: 255 })
  stellarTxHash: string;

  @Column({ name: 'cid', type: 'varchar', length: 255 })
  cid: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: AnchorStatus.PENDING,
  })
  status: AnchorStatus;

  @Column({
    name: 'aggregate_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  aggregateId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt: Date | null;
}
