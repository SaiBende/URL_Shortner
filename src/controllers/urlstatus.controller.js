import { URL } from "../models/url.model.js";
import { Visit } from "../models/visit.model.js";

export const handleURLStatus = async (req, res) => {
    const { shortId } = req.params;

    try {
        // `visitHistory` is select:false on the schema so dashboard/list queries
        // never pay for the legacy array. Analytics explicitly opts in.
        const url = await URL.findOne({ shortId })
            .select("createdBy +visitHistory")
            .lean();

        if (!url) {
            return res.status(404).json({ error: "URL not found" });
        }

        // Only the owner can view the analytics of a URL (req.user from auth middleware)
        if (String(url.createdBy) !== req.user.user_id) {
            return res.status(403).json({ error: "You are not allowed to view this URL's analytics" });
        }

        const visits = await Visit.find({ urlId: url._id })
            .select({ clickedAt: 1 })
            .sort({ clickedAt: 1 })
            .lean();

        // Keep the response shape the current chart expects. Legacy timestamps
        // are merged with the new Visit collection so no history is lost during
        // the transition.
        const visitHistory = [
            ...(url.visitHistory || []).map((visit) => ({
                timestamp: visit.timestamp,
            })),
            ...visits.map((visit) => ({
                timestamp: new Date(visit.clickedAt).getTime(),
            })),
        ]
            .filter((visit) => Number.isFinite(visit.timestamp))
            .sort((a, b) => a.timestamp - b.timestamp);

        return res.status(200).json({
            visitHistory,
            visitHistoryLength: visitHistory.length,
            visitCount: visitHistory.length,
            shortId,
        });
    } catch (error) {
        console.error("Error fetching URL status:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};
