import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { db } from "./db.js";
import routes from "./routes/index.js";

const app = express();

app.use(helmet());
app.use(
	cors({
		origin: process.env.CORS_ORIGIN || "http://localhost:5173",
	}),
);
app.use(express.json());

// Rate limiting: 100 requests per minute per IP
const limiter = rateLimit({
	windowMs: 60 * 1000,
	max: 100,
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
