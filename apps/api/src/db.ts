import pgPromise from "pg-promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is required");
}

function getSSLConfig(): false | { ca: string; rejectUnauthorized: true } {
	const ca = process.env.DB_CA_CERT;
	if (!ca) {
		return false;
	}
	return { ca, rejectUnauthorized: true };
}

const pgp = pgPromise();

export const db = pgp({
	connectionString: DATABASE_URL,
	// Pool configuration
	max: Number(process.env.DB_POOL_MAX) || 20,
	idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT) || 30000,
	connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT) || 5000,
	ssl: getSSLConfig(),
});
