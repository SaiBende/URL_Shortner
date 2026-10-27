import { URL } from "../models/url.model.js";
import { User } from "../models/user.model.js";
import { resolveCategory } from "../utils/plans.js";

const dashboard = async (req, res) => {
    try {
        // req.user is set by the auth middleware
        const userId = req.user.user_id;

        // Fetch the user from the database
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Lazy plan expiry: downgrade to basic once the paid period has lapsed
        const effectiveCategory = resolveCategory(user);
        if (effectiveCategory !== user.category) {
            user.category = effectiveCategory;
            user.planExpiresAt = null;
            await user.save();
        }

        // Fetch the URLs created by this user
        const urls = await URL.find({ createdBy: userId });

        return res.status(200).json({
            success: true,
            user: {
                username: user.username,
                email: user.email,
                category: user.category,
                planExpiresAt: user.planExpiresAt,
                urlCount: user.urlCount,
                profilephoto: user.profilephoto,
            },
            urls,
        });
    } catch (error) {
        console.error("Error in dashboard controller:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export { dashboard };
