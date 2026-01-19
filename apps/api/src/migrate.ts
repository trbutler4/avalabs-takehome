import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pool } from './db.js'

async function migrate() {
  const client = await pool.connect()

  try {
    // Create tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    // Get applied migrations
    const { rows: applied } = await client.query<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version'
    )
    const appliedVersions = new Set(applied.map(r => r.version))

    // Read migration files
    const migrationsDir = join(import.meta.dirname, '../migrations')
    const files = await readdir(migrationsDir)
    const migrations = files
      .filter(f => f.endsWith('.sql'))
      .map(f => {
        const match = f.match(/^(\d+)_(.+)\.sql$/)
        if (!match) throw new Error(`Invalid migration filename: ${f}`)
        return { version: parseInt(match[1], 10), name: match[2], file: f }
      })
      .filter(m => !appliedVersions.has(m.version))
      .sort((a, b) => a.version - b.version)

    if (migrations.length === 0) {
      console.log('No pending migrations')
      return
    }

    // Apply pending migrations
    for (const migration of migrations) {
      const filePath = join(migrationsDir, migration.file)
      const content = await readFile(filePath, 'utf-8')

      console.log(`Applying migration ${migration.version}_${migration.name}...`)

      await client.query('BEGIN')
      try {
        await client.query(content)
        await client.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
          [migration.version, migration.name]
        )
        await client.query('COMMIT')
        console.log(`Applied migration ${migration.version}_${migration.name}`)
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      }
    }

    console.log(`Applied ${migrations.length} migration(s)`)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
