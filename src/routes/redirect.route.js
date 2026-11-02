import express from "express";
import { handleRedirect302 } from "../controllers/redirecturl.controller.js";

const redirectRoute = express.Router();

// Fast path: responds with a 302 and never boots the SPA or Clerk.
redirectRoute.get("/:shortId", handleRedirect302);

export { redirectRoute };
