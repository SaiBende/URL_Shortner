import express from "express";
import { getPublicSite } from "../controllers/publicsite.controller.js";

const publicsiteRoute = express.Router();

// GET /api/public/site?host=handle.sggs.saibende.in
publicsiteRoute.get("/site", getPublicSite);

export { publicsiteRoute };
