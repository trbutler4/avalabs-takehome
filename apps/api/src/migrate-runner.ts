import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
	const direction = process.argv[2] as "up" | "down";
	if (!direction || !["up", "down"].includes(direction)) {
		console.error("Usage: migrate-runner.ts <up|down>");
		process.exit(1);
	}

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("DATABASE_URL is required");
	}

	// Append uselibpqcompat=true for standard PostgreSQL SSL behavior
	// This is DigitalOcean's recommended fix for App Platform database connections
	const separator = databaseUrl.includes("?") ? "&" : "?";
	const connectionString = `${databaseUrl}${separator}uselibpqcompat=true`;

	const client = new pg.Client({ connectionString });

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
