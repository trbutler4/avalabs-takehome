import pgPromise from "pg-promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is required");
}

// Append uselibpqcompat=true for standard PostgreSQL SSL behavior
// This is DigitalOcean's recommended fix for App Platform database connections
const separator = DATABASE_URL.includes("?") ? "&" : "?";
const connectionString = `${DATABASE_URL}${separator}uselibpqcompat=true`;

const pgp = pgPromise();

export const db = pgp({
	connectionString,
	// Pool configuration
	max: Number(process.env.DB_POOL_MAX) || 20,
	idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT) || 30000,
	connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT) || 5000,
});
