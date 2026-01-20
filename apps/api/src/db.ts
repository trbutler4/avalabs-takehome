import pgPromise from "pg-promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is required");
}

const pgp = pgPromise();

export const db = pgp({
	connectionString: DATABASE_URL,
	// Pool configuration
	max: Number(process.env.DB_POOL_MAX) || 20,
	idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT) || 30000,
	connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT) || 5000,
	// SSL for managed databases (RDS, Heroku, etc). rejectUnauthorized: false allows
	// connections without verifying the server certificate - data is still encrypted,
	// but we're not validating server identity. This is common practice when the DB
	// provider's CA isn't in Node's trust store. For stricter security, provide the
	// CA cert via the `ca` option instead.
	ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});
