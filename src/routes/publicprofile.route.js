import express from "express";
import { publicprofile,addsocialmedialinkpublicprofilelink ,deletesocialmedialinkpublicprofilelink } from "../controllers/publicprofile/publicprofile.controller.js";
import { auth } from "../middlewares/auth.middleware.js";

const publicprofileroute = express.Router();

publicprofileroute.get("/:username",publicprofile);
publicprofileroute.post("/:username/social-media/add",auth,addsocialmedialinkpublicprofilelink );
publicprofileroute.put("/:username/social-media/delete",auth,deletesocialmedialinkpublicprofilelink );




export {publicprofileroute}