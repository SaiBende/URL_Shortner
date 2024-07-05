import express from "express";
import cors from "cors";
import { router } from "./routes/url.router.js";



const app= express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded());
app.use(express.static("public"))

app.use("/",router);
// app.get("/:shortId", async (req, res) => {
//   console.log(req.params)
//     const shortId = req.params.shortId;
//     const entry = await URL.findOneAndUpdate(
//       {
//         shortId,
//       },
//       {
//         $push: {
//           visitHistory: {
//             timestamp: Date.now(),
//           },
//         },
//       }
//     );
//     res.redirect(entry.redirectURL);
//   });


export {app}
