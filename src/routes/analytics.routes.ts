import { Router } from "express";
import { analyticsController } from "../controllers/analytics.controller";

const router = Router();
router.post("/whatsapp", analyticsController.whatsapp);
export default router;
