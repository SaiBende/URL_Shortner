import shortid from "shortid";
import { URL } from "../models/url.model.js";
import { User } from "../models/user.model.js";
import { URL_LIMITS, resolveCategory } from "../utils/plans.js";
import { isReservedShortId } from "../utils/shortId.js";

async function handleGenerateNewShortURL(req, res) {
    try {
        // req.user is set by the auth middleware
        const userId = req.user.user_id;

        // Fetch the user from the database
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Effective category (respects plan expiry)
        const category = resolveCategory(user);
        const urlLimit = URL_LIMITS[category];

        // Check if the user has reached their limit
        if (user.urlCount >= urlLimit) {
            return res.status(403).json({ error: `You have reached your limit of ${urlLimit} short URLs` });
        }

        const body = req.body;

        if (!body.url) {
            return res.status(400).json({ error: "URL is required" });
        }

        let newURL;
        if (!body.customURL) {
            // Generated IDs may land on a reserved name; regenerate until safe.
            let generatedShortId;
            do {
                generatedShortId = shortid.generate();
            } while (isReservedShortId(generatedShortId));

            newURL = await URL.create({
                shortId: generatedShortId,
                redirectURL: body.url,
                createdBy: userId,
                visitHistory: [],
            });
        } else {
            if (isReservedShortId(body.customURL)) {
                return res.status(400).json({ error: "This short URL is reserved" });
            }
            const alreadypresenturl = await URL.findOne({ shortId: body.customURL });
            if (alreadypresenturl) {
                return res.status(400).json({ error: "Custom URL already present" });
            }
            newURL = await URL.create({
                shortId: body.customURL,
                redirectURL: body.url,
                createdBy: userId,
                visitHistory: [],
            });
        }

        // Increment the user's URL count after successful creation
        user.urlCount += 1;
        await user.save();

        return res.json({ id: newURL.shortId, message: "URL created successfully" });
    } catch (error) {
        // Duplicate key race condition (custom URL taken between check and insert)
        if (error.code === 11000) {
            return res.status(400).json({ error: "This short URL is already taken" });
        }
        console.error("Error creating short URL:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

export { handleGenerateNewShortURL };
