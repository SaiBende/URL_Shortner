import express from "express";
import { createCheckoutSession, sessionStatus, listOrders } from "../controllers/checkout.controller.js";
import { auth } from "../middlewares/auth.middleware.js";

const checkoutRoute = express.Router();

// Requires login — the session is tied to the paying user via metadata
checkoutRoute.post("/create-checkout-session", auth, createCheckoutSession);
// Requires login — only the session owner can read/apply its status
checkoutRoute.get("/session-status", auth, sessionStatus);
// Purchase history
checkoutRoute.get("/orders", auth, listOrders);

export { checkoutRoute };
