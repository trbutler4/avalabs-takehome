import pgPromise from 'pg-promise'

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/avalabs'

const pgp = pgPromise()

export const db = pgp(DATABASE_URL)
