import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateReconciliationTables1781000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'anchor_records',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'stellar_tx_hash', type: 'varchar', length: '255' },
          { name: 'cid', type: 'varchar', length: '255' },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'pending'",
          },
          {
            name: 'aggregate_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          { name: 'updated_at', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'anchor_records',
      new TableIndex({
        name: 'idx_anchor_records_status_created',
        columnNames: ['status', 'created_at'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'reconciliation_runs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'started_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          { name: 'completed_at', type: 'timestamp', isNullable: true },
          { name: 'records_checked', type: 'int', default: 0 },
          { name: 'confirmed', type: 'int', default: 0 },
          { name: 'failed', type: 'int', default: 0 },
          { name: 'missing', type: 'int', default: 0 },
          { name: 'errors', type: 'int', default: 0 },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'reconciliation_runs',
      new TableIndex({
        name: 'idx_reconciliation_runs_started_at',
        columnNames: ['started_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('reconciliation_runs', true);
    await queryRunner.dropTable('anchor_records', true);
  }
}
