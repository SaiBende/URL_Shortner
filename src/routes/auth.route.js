import express from "express";
import { isauthenticated } from "../controllers/auth.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { dashboard } from "../controllers/dashboard.controller.js";

const authroute = express.Router();

// Both endpoints also lazily create/link the MongoDB user for the Clerk session.
authroute.post("/isauth", auth, isauthenticated);
authroute.post("/dashboard", auth, dashboard);

export { authroute };
