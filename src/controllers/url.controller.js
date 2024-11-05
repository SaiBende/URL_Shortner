import shortid from "shortid";
import jwt from "jsonwebtoken";
import { URL } from "../models/url.model.js";
import { User } from "../models/user.model.js";

async function handleGenerateNewShortURL(req, res) {
    //const { token } = req.cookies;
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(401).json({ error: "You are not logged in" });
    }

    try {
        // Decode the JWT token to get the user information
        const decoded = jwt.verify(token, process.env.TOKEN_KEY);

        if (!decoded.user_id) {
            return res.status(401).json({ error: "Invalid token" });
        }

        const userId = decoded.user_id;

        // Fetch the user from the database
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const userCategory = user.category;
        let urlLimit;

        if (userCategory === "basic") {
            urlLimit = 10;
        } else if (userCategory === "standard") {
            urlLimit = 30;
        } else if (userCategory === "premium") {
            urlLimit = Infinity; // No limit for premium users
        } else {
            return res.status(400).json({ error: "Invalid user category" });
        }

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
            const shortID = shortid.generate();
            newURL = await URL.create({
                shortId: shortID,
                redirectURL: body.url,
                createdBy: userId,
                visitHistory: []
            });
        } else {
            const alreadypresenturl = await URL.findOne({ shortId: body.customURL });
            if (alreadypresenturl) {
                return res.json({ error: "Custom URL already present" });
            }
            newURL = await URL.create({
                shortId: body.customURL,
                redirectURL: body.url,
                createdBy: userId,
                visitHistory: []
            });
        }

        // Increment the user's URL count after successful creation
        user.urlCount += 1;
        await user.save();

        return res.json({ id: newURL.shortId, message: "URL created successfully" });
    } catch (error) {
        console.error("Error decoding token:", error);
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

export { handleGenerateNewShortURL };
