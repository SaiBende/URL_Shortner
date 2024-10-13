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
            description: user.description,
        };

        // Render the profile page (or send JSON if you're using a REST API)
        console.log(profileData);
        return res.status(200).json(profileData);

    } catch (error) {
        console.error("Error in public profile route:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

const addsocialmedialinkpublicprofilelink = async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ error: "You are not logged in" });
        }

        const decoded = jwt.verify(token, process.env.TOKEN_KEY);
        const userId = decoded.user_id;

        const { platform, link } = req.body;

        if (!platform || !link) {
            return res.status(400).json({ error: "Platform and link are required" });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.socialMediaLinks.set(platform, link); // Add or update the link
        await user.save();

        return res.status(200).json({
            success: true,
            message: `${platform} link added successfully`,
            socialMediaLinks: user.socialMediaLinks,
        });

    } catch (error) {
        console.error("Error adding social media link:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

const deletesocialmedialinkpublicprofilelink =async(req,res)=>{
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ error: "You are not logged in" });
        }

        const decoded = jwt.verify(token, process.env.TOKEN_KEY);
        const userId = decoded.user_id;

        const { platform } = req.body;

        console.log("Platform to delete:", platform);

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        console.log("User's social media links:", user.socialMediaLinks);

        if (!user.socialMediaLinks || !user.socialMediaLinks.has(platform)) {
            return res.status(400).json({ error: `${platform} link does not exist` });
        }

        user.socialMediaLinks.delete(platform); // Delete the link
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

const adddescriptionpublicprofile = async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ error: "You are not logged in" });
        }

        const decoded = jwt.verify(token, process.env.TOKEN_KEY);
        const userId = decoded.user_id;

        const { description } = req.body;

        if (!description) {
            return res.status(400).json({ error: "Description is required" });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.description = description;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Description updated successfully",
            description: user.description,
        });

    } catch (error) {
        console.error("Error updating description:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}


export {publicprofile , addsocialmedialinkpublicprofilelink,deletesocialmedialinkpublicprofilelink,adddescriptionpublicprofile}; 