import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pgPromise from "pg-promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is required");
}

function getSSLConfig(): false | { ca: string } {
	if (process.env.DB_SSL !== "true") {
		return false;
	}
	const __dirname = dirname(fileURLToPath(import.meta.url));
	const caPath = join(__dirname, "..", "certs", "ca-certificate.crt");
	const ca = readFileSync(caPath, "utf-8");
	return { ca };
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
