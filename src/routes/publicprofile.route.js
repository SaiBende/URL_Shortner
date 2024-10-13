import express from "express";
import { publicprofile,addsocialmedialinkpublicprofilelink ,deletesocialmedialinkpublicprofilelink,adddescriptionpublicprofile } from "../controllers/publicprofile/publicprofile.controller.js";
import { auth } from "../middlewares/auth.middleware.js";

const publicprofileroute = express.Router();

publicprofileroute.get("/:username",publicprofile);
publicprofileroute.post("/:username/social-media/add",auth,addsocialmedialinkpublicprofilelink );
publicprofileroute.delete("/:username/social-media/delete",auth,deletesocialmedialinkpublicprofilelink );
publicprofileroute.post("/:username/description",auth,adddescriptionpublicprofile);



export {publicprofileroute}