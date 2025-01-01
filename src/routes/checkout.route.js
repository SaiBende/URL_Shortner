import express from "express";
import { createCheckoutSession ,sessionStatus} from "../controllers/checkout.controller.js";


const checkoutRoute = express.Router();

checkoutRoute.post("/create-checkout-session", createCheckoutSession);
checkoutRoute.get("/session-status", sessionStatus);

export { checkoutRoute };