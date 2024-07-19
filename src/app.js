import express from "express";
import cors from "cors";
import { router } from "./routes/url.router.js";



const app= express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded());
app.use(express.static("public"))

app.use("/",router);



export {app}
