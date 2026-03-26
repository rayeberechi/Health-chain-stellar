import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateEventStoreTables1780000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'event_store',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'aggregate_id', type: 'varchar', length: '255' },
          { name: 'aggregate_type', type: 'varchar', length: '100' },
          { name: 'event_type', type: 'varchar', length: '100' },
          { name: 'payload', type: 'jsonb', default: "'{}'" },
          { name: 'metadata', type: 'jsonb', default: "'{}'" },
          { name: 'version', type: 'int' },
          {
            name: 'occurred_at',
            type: 'timestamp with time zone',
          },
          {
            name: 'recorded_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        uniques: [
          {
            name: 'UQ_event_store_aggregate_version',
            columnNames: ['aggregate_id', 'version'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'event_store',
      new TableIndex({
        name: 'idx_event_store_aggregate_type',
        columnNames: ['aggregate_id', 'aggregate_type'],
      }),
    );

    // Append-only enforcement: block UPDATE and DELETE on event_store
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_event_store_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'event_store is append-only: % operations are not permitted', TG_OP;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_event_store_no_update
      BEFORE UPDATE ON event_store
      FOR EACH ROW EXECUTE FUNCTION prevent_event_store_mutation();
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_event_store_no_delete
      BEFORE DELETE ON event_store
      FOR EACH ROW EXECUTE FUNCTION prevent_event_store_mutation();
    `);

    // Snapshots table
    await queryRunner.createTable(
      new Table({
        name: 'aggregate_snapshots',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'aggregate_id',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          { name: 'aggregate_type', type: 'varchar', length: '100' },
          { name: 'version', type: 'int' },
          { name: 'state', type: 'jsonb' },
          {
            name: 'snapshot_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_event_store_no_delete ON event_store`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_event_store_no_update ON event_store`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS prevent_event_store_mutation`,
    );
    await queryRunner.dropTable('aggregate_snapshots', true);
    await queryRunner.dropTable('event_store', true);
  }
}
