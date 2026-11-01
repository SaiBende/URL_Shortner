import express from "express";
import { isauthenticated } from "../controllers/auth.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { dashboard } from "../controllers/dashboard.controller.js";
import {
    checkName,
    updateIdentity,
} from "../controllers/identity.controller.js";
import { identityLimiter } from "../middlewares/ratelimit.middleware.js";

const authroute = express.Router();

// These endpoints also lazily create/link the MongoDB user for the Clerk session.
authroute.post("/isauth", auth, isauthenticated);
authroute.post("/dashboard", auth, dashboard);

// Username and subdomain share one reservation pool. The check endpoint is
// rate-limited because the editor calls it while the user types.
authroute.post("/name-check", identityLimiter, auth, checkName);
authroute.post("/identity", identityLimiter, auth, updateIdentity);

export { authroute };
