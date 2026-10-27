import express from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { getBilling, refreshBilling } from "../controllers/billing.controller.js";

const billingRoute = express.Router();

// Current Clerk Billing plan and subscription snapshot (from the local cache).
billingRoute.get("/", auth, getBilling);
// Force a fresh pull from Clerk (used after checkout).
billingRoute.post("/sync", auth, refreshBilling);

export { billingRoute };
