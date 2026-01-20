import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getSSLConfig(): false | { ca: string } {
	if (process.env.DB_SSL !== "true") {
		return false;
	}
	const caPath = join(__dirname, "..", "certs", "ca-certificate.crt");
	const ca = readFileSync(caPath, "utf-8");
	return { ca };
}

async function runMigrations() {
	const direction = process.argv[2] as "up" | "down";
	if (!direction || !["up", "down"].includes(direction)) {
		console.error("Usage: migrate-runner.ts <up|down>");
		process.exit(1);
	}

	const ssl = getSSLConfig();
	const client = new pg.Client({
		connectionString: process.env.DATABASE_URL,
		ssl,
	});

	await client.connect();

	try {
		await runner({
			dbClient: client,
			dir: join(__dirname, "..", "migrations"),
			direction,
			migrationsTable: "pgmigrations",
			schema: "public",
			verbose: true,
			log: console.log,
		});
	} finally {
		await client.end();
	}
}

runMigrations().catch((err) => {
	console.error("Migration failed:", err);
	process.exit(1);
});
