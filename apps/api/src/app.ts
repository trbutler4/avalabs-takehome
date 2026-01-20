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
	try {
		await db.one("SELECT 1");
		res.json({ status: "healthy", database: "connected" });
	} catch {
		res.status(503).json({ status: "unhealthy", database: "disconnected" });
	}
});

app.use("/", routes);

// Global error handler - must be last
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
	console.error("Unhandled error:", err);
	res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

export default app;
