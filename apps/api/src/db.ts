import pg from 'pg'

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/avalabs'

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
})
