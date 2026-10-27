import { URL } from "../models/url.model.js";
import { User } from "../models/user.model.js";

const handleDeleteURL = async (req, res) => {
    const { shortId } = req.params;

    try {
        // Only the owner can delete their URL (req.user from auth middleware)
        const url = await URL.findOneAndDelete({ shortId, createdBy: req.user.user_id });

        if (!url) {
            return res.status(404).json({ error: "This URL is not present" });
        }

        // Keep the user's URL count in sync (never below zero)
        await User.updateOne({ _id: req.user.user_id, urlCount: { $gt: 0 } }, { $inc: { urlCount: -1 } });

        return res.status(200).json({ success: true, message: "Short URL deleted successfully" });
    } catch (error) {
        console.error("Error deleting URL:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export { handleDeleteURL };
