import { URL } from "../models/url.model.js";

export const handleURLStatus = async (req, res) => {
    const { shortId } = req.params;

    try {
        const url = await URL.findOne({ shortId });

        if (!url) {
            return res.status(404).json({ error: "URL not found" });
        }

        // Only the owner can view the analytics of a URL (req.user from auth middleware)
        if (url.createdBy.toString() !== req.user.user_id) {
            return res.status(403).json({ error: "You are not allowed to view this URL's analytics" });
        }

        const visitHistory = url.visitHistory;

        const visitHistoryLength = url.visitHistory.length;

        return res.status(200).json({ visitHistory, visitHistoryLength, shortId });
    } catch (error) {
        console.error("Error fetching URL status:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};
