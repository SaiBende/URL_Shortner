import { User } from "../../models/user.model.js";
import jwt from "jsonwebtoken";
import multer from 'multer';
import cloudinary from "../../utils/cloudinary.js";
import fs from 'fs';
import { profile } from "console";



const publicprofile = async (req, res) => {
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
            profilephoto: user.profilephoto,
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
        //const token = req.cookies.token;
        const token = req.headers['authorization'];
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

const deletesocialmedialinkpublicprofilelink = async (req, res) => {
    try {
        //const token = req.cookies.token;
        const token = req.headers['authorization'];
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
        //const token = req.cookies.token;
        const token = req.headers['authorization'];
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


//profile photo update

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Controller function to update profile photo
const updateProfilePhoto = async (req, res) => {
    try {
        upload.single('profilephoto')(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ error: 'Error uploading the photo' });
            }

            // Check if file is available
            if (!req.file) {
                return res.status(400).json({ error: 'No photo uploaded' });
            }

            // Upload the photo buffer to Cloudinary
            cloudinary.uploader.upload_stream(
                { folder: 'user_profile_photos' },
                async (error, result) => {
                    if (error) {
                        return res.status(400).json({ error: 'Error uploading the photo to Cloudinary' });
                    }

                    const photoUrl = result.secure_url;

                    // Verify the token
                    const token = req.headers['authorization'];
                    if (!token) {
                        return res.status(401).json({ error: "You are not logged in" });
                    }

                    const decoded = jwt.verify(token, process.env.TOKEN_KEY);
                    const userId = decoded.user_id;

                    try {
                        // Update the user profile photo URL in the database
                        const user = await User.findByIdAndUpdate(userId, { profilephoto: photoUrl }, { new: true });

                        if (!user) {
                            return res.status(404).json({ error: 'User not found' });
                        }

                        // Send the response back
                        res.status(200).json({
                            success: true,
                            message: 'Profile photo updated successfully',
                            profilePhotoUrl: photoUrl,
                            user,
                        });
                    } catch (updateError) {
                        console.error('Error updating user profile photo:', updateError);
                        res.status(500).json({ error: 'Error updating user profile photo' });
                    }
                }
            ).end(req.file.buffer);
        });
    } catch (error) {
        console.error('Error updating profile photo:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


export { publicprofile, addsocialmedialinkpublicprofilelink, deletesocialmedialinkpublicprofilelink, adddescriptionpublicprofile, updateProfilePhoto }; 