import app from "./app.js";
import { sync } from "./coingecko.js";
import { db } from "./db.js";

const PORT = Number(process.env.PORT ?? 3000);
const SHUTDOWN_TIMEOUT_MS = 10_000; // Force exit if graceful shutdown hangs

function validateEnv() {
	const required = ["DATABASE_URL", "ALCHEMY_API_KEY"];
	const missing = required.filter((key) => !process.env[key]);

	if (missing.length > 0) {
		console.error(
			`Missing required environment variables: ${missing.join(", ")}`,
		);
		process.exit(1);
	}
}

async function main() {
	validateEnv();

	// Sync on startup if DB is empty
	const { count } = await db.one<{ count: string }>(
		"SELECT COUNT(*) as count FROM networks",
	);
	if (Number(count) === 0) {
		console.info("Database empty, running initial sync...");
		await sync();
	}

	const server = app.listen(PORT, "0.0.0.0", () => {
		console.info(`Server listening on http://0.0.0.0:${PORT}`);
	});

	const shutdown = () => {
		console.info("\nShutting down...");

		const forceExit = setTimeout(() => {
			console.error("Shutdown timed out, forcing exit");
			process.exit(1);
		}, SHUTDOWN_TIMEOUT_MS);

		server.closeAllConnections();
		server.close(() => {
			clearTimeout(forceExit);
			db.$pool.end().then(() => process.exit(0));
		});
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}

main().catch(console.error);
