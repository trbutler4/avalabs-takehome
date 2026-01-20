import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('networks', {
    id: { type: 'text', primaryKey: true },
    chain_id: { type: 'integer' },
    name: { type: 'text', notNull: true },
    native_coin_id: { type: 'text' },
    synced_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.createTable('tokens', {
    id: { type: 'text', notNull: true },
    network_id: {
      type: 'text',
      notNull: true,
      references: 'networks',
      onDelete: 'CASCADE',
    },
    symbol: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    contract_address: { type: 'text' },
    synced_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.addConstraint('tokens', 'tokens_pkey', {
    primaryKey: ['id', 'network_id'],
  });

  pgm.createIndex('tokens', 'network_id');
  pgm.createIndex('tokens', 'symbol');
  pgm.createIndex('tokens', 'name');
  pgm.createIndex('tokens', 'contract_address');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('tokens');
  pgm.dropTable('networks');
}
