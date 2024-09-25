import { User } from "../../models/user.model.js";
import jwt from "jsonwebtoken";
const publicprofile = async (req,res)=>{
    try {
        const { username } = req.params;
        console.log(username);
        // Find the user by username
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Create a response with the user's social media links
        const profileData = {
            username: user.username,
            socialMediaLinks: user.socialMediaLinks,
        };

        // Render the profile page (or send JSON if you're using a REST API)
        return res.status(200).json(profileData);

    } catch (error) {
        console.error("Error in public profile route:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}


const addsocialmedialinkpublicprofilelink = async(req,res)=>{
    try {
        const { token } = req.cookies;
        if (!token) {
            return res.status(401).json({ error: "You are not logged in" });
        }

        const decoded = jwt.verify(token, process.env.TOKEN_KEY);
        const userId = decoded.user_id;

        const { platform, link } = req.body;

        // Check if the platform is allowed
        const allowedPlatforms = ["leetcode","twitter", "facebook", "instagram", "linkedin"];
        if (!allowedPlatforms.includes(platform)) {
            return res.status(400).json({ error: `Invalid platform. Allowed platforms: ${allowedPlatforms.join(", ")}` });
        }

        if (!link) {
            return res.status(400).json({ error: "Link is required" });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.socialMediaLinks[platform] = link; // Update the link
        await user.save();

        return res.status(200).json({
            success: true,
            message: `${platform} link updated successfully`,
            socialMediaLinks: user.socialMediaLinks,
        });

    } catch (error) {
        console.error("Error updating social media link:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

const deletesocialmedialinkpublicprofilelink =async(req,res)=>{
    try {
        const { token } = req.cookies;
        if (!token) {
            return res.status(401).json({ error: "You are not logged in" });
        }

        const decoded = jwt.verify(token, process.env.TOKEN_KEY);
        const userId = decoded.user_id;

        const { platform } = req.body;

        // Check if the platform is allowed
        const allowedPlatforms = ["leetcode","twitter", "facebook", "instagram", "linkedin"];
        if (!allowedPlatforms.includes(platform)) {
            return res.status(400).json({ error: `Invalid platform. Allowed platforms: ${allowedPlatforms.join(", ")}` });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.socialMediaLinks[platform] = ""; // Clear the link
        await user.save();

        return res.status(200).json({
            success: true,
            message: `${platform} link deleted successfully`,
            socialMediaLinks: user.socialMediaLinks,
        });

    } catch (error) {
        console.error("Error deleting social media link:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}


export {publicprofile , addsocialmedialinkpublicprofilelink,deletesocialmedialinkpublicprofilelink }