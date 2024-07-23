
import shortid from "shortid";
import { URL } from "../models/url.model.js"
async function handleGenerateNewShortURL(req, res) {
   const body = req.body;
   if (!body.url) { return res.status(400).json({ error: "url is required" }) };
  
   if (!body.customURL) {
      const shortID = shortid.generate();
      await URL.create({
         shortId: shortID,
         redirectURL: body.url,
         visitHistory: []
      });
      return res.json({ id: shortID })
   }
   else{
      const alreadypresenturl= await URL.findOne({shortId: body.customURL})
      if(alreadypresenturl){
         return res.json({error: "custom url already present" });
      }
      await URL.create({
         shortId: body.customURL,
         redirectURL: body.url,
         visitHistory: []
      });
   }


   return res.json({ id: body.customURL , message:"url created successfully"})
   
}

export { handleGenerateNewShortURL }