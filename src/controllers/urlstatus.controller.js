import { URL } from "../models/url.model.js";

export const handleURLStatus = async (req, res) => {
    const { shortId } = req.params;

    try {
        const url = await URL.findOne({ shortId });

        if (!url) {
            return res.status(404).send({ error: "URL not found" });
        }

        const visitHistoryLength = url.visitHistory.length;

        res.status(200).send({ visitHistoryLength, shortId });
    } catch (error) {
        console.error("Error fetching URL status:", error);
        res.status(500).send({ error: "Internal Server Error" });
    }
};

