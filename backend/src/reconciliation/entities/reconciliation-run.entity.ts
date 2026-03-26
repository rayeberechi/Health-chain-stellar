import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('reconciliation_runs')
export class ReconciliationRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'records_checked', type: 'int', default: 0 })
  recordsChecked: number;

  @Column({ type: 'int', default: 0 })
  confirmed: number;

  @Column({ type: 'int', default: 0 })
  failed: number;

  @Column({ type: 'int', default: 0 })
  missing: number;

  @Column({ type: 'int', default: 0 })
  errors: number;
}
