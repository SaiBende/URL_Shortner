
import { URL } from "../models/url.model.js";

const handleRedirect = async (req, res) => {
    try {
      const shortId = req.params.shortId;
      const entry = await URL.findOneAndUpdate(
        { shortId },
        {
          $push: {
            visitHistory: {
              timestamp: Date.now(),
            },
          },
        }
      );
      if (entry) {
        res.redirect(entry.redirectURL);
      } else {
        res.status(404).send('URL not found');
      }
    } catch (error) {
      res.status(500).send('Server error');
    }
  };
  
export {
    handleRedirect
  }