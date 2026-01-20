import pgPromise from "pg-promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is required");
}

const pgp = pgPromise();

export const db = pgp({
	connectionString: DATABASE_URL,
	// Allow self-signed certificates (DigitalOcean App Platform recommendation)
	ssl:
		process.env.NODE_ENV === "production"
			? { rejectUnauthorized: false }
			: false,
	max: Number(process.env.DB_POOL_MAX) || 20,
	idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT) || 30000,
	connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT) || 5000,
});
