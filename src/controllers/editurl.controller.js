import { URL } from "../models/url.model.js";
import { isReservedShortId } from "../utils/shortId.js";

const handleEditURL = async (req, res) => {
    const { shortId } = req.params;
    const { changeId } = req.body;

    try {
        // Check if changeId is provided
        if (!changeId) {
            return res.status(400).json({ error: "Provide the change text" });
        }

        if (isReservedShortId(changeId)) {
            return res.status(400).json({ error: "This short URL is reserved" });
        }

        // Only the owner can rename their URL (req.user from auth middleware)
        const updatedUrl = await URL.findOneAndUpdate(
            { shortId, createdBy: req.user.user_id }, // Filter
            { shortId: changeId }, // Update operation
            { new: true } // Options: return the updated document
        );

        // Check if the URL was found and updated
        if (!updatedUrl) {
            return res.status(404).json({ error: "This URL is not present" });
        }

        return res.status(200).json({ updatedUrl });
    } catch (error) {
        // Duplicate key (changeId already used by another URL)
        if (error.code === 11000) {
            return res.status(400).json({ error: "That short URL is already taken" });
        }
        console.error("Error while updating the URL:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export { handleEditURL };
