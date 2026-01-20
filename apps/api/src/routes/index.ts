import { Router } from "express";
import { generateOpenAPIDocument } from "../openapi.js";
import networksRouter from "./networks.js";
import tokensRouter from "./tokens.js";

const router = Router();

router.get("/openapi.json", (_req, res) => {
	res.json(generateOpenAPIDocument());
});

router.use("/networks", networksRouter);
router.use("/tokens", tokensRouter);

export default router;
