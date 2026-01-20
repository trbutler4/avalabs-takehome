import type { Network } from "@repo/shared";
import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/", async (_req, res) => {
	try {
		const networks = await db.manyOrNone<Network>(
			"SELECT id, chain_id, name, native_coin_id FROM networks ORDER BY name",
		);
		res.json(networks);
	} catch (err) {
		console.error("Failed to fetch networks:", err);
		res.status(500).json({ error: "Failed to fetch networks" });
	}
});

export default router;
