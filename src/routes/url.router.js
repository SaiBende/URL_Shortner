
import express from "express"
import { handleGenerateNewShortURL } from "../controllers/url.controller.js";
import {handleRedirect} from "../controllers/redirecturl.controller.js"
import { handleURLStatus } from "../controllers/urlstatus.controller.js";
import { URL } from "../models/url.model.js";

const router = express.Router();
router.post('/',handleGenerateNewShortURL);
router.get("/:shortId", handleRedirect);
router.post("/:shortId/status", handleURLStatus);



export {router}