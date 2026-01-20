import pgPromise from "pg-promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is required");
}

// NOTE: Using rejectUnauthorized: false for this demo. There is no sensitive data
// in the database and this is for quick demo purposes. The tradeoff is vulnerability
// to MITM attacks since we can't verify we're talking to the real database server.
// For production with sensitive data, use a CA certificate approach instead.
function getSSLConfig(): false | { rejectUnauthorized: false } {
	if (process.env.DB_SSL !== "true") {
		return false;
	}
	return { rejectUnauthorized: false };
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
