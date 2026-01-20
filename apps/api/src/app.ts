import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { db } from "./db.js";
import routes from "./routes/index.js";

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // requests per window

const app = express();

app.use(helmet());

// Support multiple CORS origins (comma-separated in env)
const corsOrigins = process.env.CORS_ORIGIN
	? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
	: ["http://localhost:5173"];

app.use(
	cors({
		origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
	}),
);
app.use(express.json());

const limiter = rateLimit({
	windowMs: RATE_LIMIT_WINDOW_MS,
	max: RATE_LIMIT_MAX_REQUESTS,
	message: { error: "Too many requests, please try again later" },
	standardHeaders: true,
	legacyHeaders: false,
});
app.use(limiter);

// Health check endpoint
app.get("/health", async (_req, res) => {
	const checks = {
		database: false,
		alchemy: !!process.env.ALCHEMY_API_KEY,
	};

	try {
		await db.one("SELECT 1");
		checks.database = true;
	} catch {
		// database check failed
	}

	const healthy = Object.values(checks).every(Boolean);
	res.status(healthy ? 200 : 503).json({
		status: healthy ? "healthy" : "unhealthy",
		checks,
	});
});

app.use("/", routes);

// Global error handler - must be last
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
	console.error("Unhandled error:", err);
	res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

export default app;
