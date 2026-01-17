import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/avalabs'

export const sql = postgres(DATABASE_URL)

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS networks (
      id TEXT PRIMARY KEY,
      chain_id INTEGER,
      name TEXT NOT NULL,
      native_coin_id TEXT,
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS tokens (
      id TEXT NOT NULL,
      network_id TEXT NOT NULL REFERENCES networks(id),
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      contract_address TEXT,
      synced_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (id, network_id)
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_tokens_network ON tokens(network_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tokens_symbol ON tokens(symbol)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tokens_name ON tokens(name)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tokens_address ON tokens(contract_address)`
}
