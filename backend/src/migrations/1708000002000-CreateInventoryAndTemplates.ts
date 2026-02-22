import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateInventoryAndTemplates1708000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create inventory table
    await queryRunner.createTable(
      new Table({
        name: 'inventory',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'blood_type',
            type: 'varchar',
          },
          {
            name: 'region',
            type: 'varchar',
          },
          {
            name: 'quantity',
            type: 'int',
            default: 0,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Create unique index on blood_type + region
    await queryRunner.createIndex(
      'inventory',
      new TableIndex({
        name: 'IDX_INVENTORY_BLOOD_TYPE_REGION',
        columnNames: ['blood_type', 'region'],
        isUnique: true,
      }),
    );

    // Insert notification templates for inventory alerts
    await queryRunner.query(`
      INSERT INTO notification_templates (id, template_key, channel, body, created_at, updated_at)
      VALUES 
        (uuid_generate_v4(), 'inventory-low-alert', 'in-app', 
         'Low inventory alert: {{bloodType}} in {{region}}. Current stock: {{currentStock}} units. Projected days remaining: {{daysRemaining}}. Average daily demand: {{averageDailyDemand}} units.',
         now(), now()),
        (uuid_generate_v4(), 'inventory-low-alert', 'sms', 
         'URGENT: {{bloodType}} blood low in {{region}}. {{currentStock}} units left (~{{daysRemaining}} days). Please coordinate donor outreach.',
         now(), now())
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM notification_templates 
      WHERE template_key = 'inventory-low-alert';
    `);

    await queryRunner.dropIndex('inventory', 'IDX_INVENTORY_BLOOD_TYPE_REGION');
    await queryRunner.dropTable('inventory');
  }
}
