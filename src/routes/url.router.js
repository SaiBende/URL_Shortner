
import express from "express"
import { handleGenerateNewShortURL } from "../controllers/url.controller.js";
import {handleRedirect} from "../controllers/redirecturl.controller.js"
import { handleURLStatus } from "../controllers/urlstatus.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { handleEditURL } from "../controllers/editurl.controller.js";
import { handleDeleteURL } from "../controllers/deleteurl.controller.js";

const router = express.Router();
router.post('/',auth,handleGenerateNewShortURL);
router.get("/:shortId", handleRedirect);
router.post("/:shortId/status",auth, handleURLStatus);
router.post("/:shortId/edit",auth, handleEditURL);
router.delete("/:shortId",auth, handleDeleteURL);

export {router}
