import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { router } from "./routes/url.router.js";
import { authroute } from "./routes/auth.route.js";

const app= express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded());
app.use(express.static("public"))

app.use("/",router);
app.use("/user",authroute)


export {app}
