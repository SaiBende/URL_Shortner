import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { router } from "./routes/url.router.js";
import { authroute } from "./routes/auth.route.js";
import { publicprofileroute } from "./routes/publicprofile.route.js";
import { checkoutRoute } from "./routes/checkout.route.js";

const app= express();

const corsOptions = {
    origin: ['http://localhost:5173','https://sggs-kappa.vercel.app','https://sggs.me'], // Allow all origins
    credentials: true, // Allow credentials (cookies) to be sent
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded());
app.use(express.static("public"))

app.use("/api",router);
app.use("/api/user",authroute);
app.use("/api/u",publicprofileroute);
app.use("/api/payment",checkoutRoute);



export {app}
