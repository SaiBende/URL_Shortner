import express from "express";
import { register,login,logout, isauthenticated } from "../controllers/auth.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { dashboard } from "../controllers/dashboard.controller.js";


const authroute=express.Router();

authroute.post('/',isauthenticated);

authroute.post('/register',register);
authroute.post('/login',login);
authroute.post('/dashboard',auth,dashboard)
authroute.get('/logout',auth,logout);

export {authroute}